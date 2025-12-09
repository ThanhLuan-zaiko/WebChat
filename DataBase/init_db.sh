#!/bin/bash

# --- CẤU HÌNH KHỚP VỚI LỆNH DOCKER RUN CỦA BẠN ---
CONTAINER_NAME="mypg"        # Tên container bạn đặt
ADMIN_USER="admin"           # User quản trị bạn đã set (thay vì postgres)
ADMIN_DB="mydb"              # DB mặc định có sẵn để admin đăng nhập vào
# -------------------------------------------------

# Cấu hình cho dự án mới
NEW_DB_NAME="webchat_db"
NEW_DB_USER="dev_user"
NEW_DB_PASS="123456"

# Dừng nếu có lỗi bất ngờ
set -e

echo "⏳ Đang kiểm tra container '$CONTAINER_NAME'..."
# Kiểm tra xem container có đang chạy không
if [ ! "$(docker ps -q -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "❌ Lỗi: Container '$CONTAINER_NAME' không chạy!"
    echo "   Hãy chạy lệnh: sudo docker start $CONTAINER_NAME"
    exit 1
fi

echo "⏳ Đang Reset và Cài đặt Database..."

# --- PHẦN 1: QUẢN TRỊ (Dùng user 'admin' để xóa/tạo) ---
# Chúng ta phải đăng nhập vào 'mydb' bằng user 'admin' để thực hiện lệnh
docker exec -i $CONTAINER_NAME psql -U $ADMIN_USER -d $ADMIN_DB <<EOF
    -- 1. Ngắt kết nối cũ (nếu có)
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE usename = '$NEW_DB_USER' AND pid <> pg_backend_pid();

    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '$NEW_DB_NAME' AND pid <> pg_backend_pid();

    -- 2. Xóa sạch cũ
    DROP DATABASE IF EXISTS $NEW_DB_NAME;
    DROP USER IF EXISTS $NEW_DB_USER;

    -- 3. Tạo mới
    CREATE USER $NEW_DB_USER WITH PASSWORD '$NEW_DB_PASS';
    CREATE DATABASE $NEW_DB_NAME OWNER $NEW_DB_USER;
    GRANT ALL ON SCHEMA public TO $NEW_DB_USER;
EOF

echo "✅ Đã tạo xong User: $NEW_DB_USER và Database: $NEW_DB_NAME"
echo "⏳ Đang tạo bảng (Tables)..."

# --- PHẦN 2: DỰ ÁN (Dùng user 'dev_user' để tạo bảng vào 'webchat_db') ---
docker exec -i $CONTAINER_NAME psql -U $NEW_DB_USER -d $NEW_DB_NAME <<EOF
    -- Config Types
    CREATE TYPE message_type_enum AS ENUM ('text', 'image', 'video', 'file', 'system');
    CREATE TYPE user_role_enum AS ENUM ('admin', 'member');

    -- Tables
    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        is_group BOOLEAN DEFAULT FALSE,
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        content TEXT,
        type message_type_enum DEFAULT 'text',
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE conversation_participants (
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role user_role_enum DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        file_url TEXT NOT NULL,
        file_type VARCHAR(50),
        file_name VARCHAR(255),
        file_size BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes & Triggers
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC);
    CREATE INDEX idx_participants_user ON conversation_participants(user_id);

    CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS \$\$
    BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; \$\$ language 'plpgsql';

    CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    CREATE TRIGGER update_conversations_modtime BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    CREATE TRIGGER update_messages_modtime BEFORE UPDATE ON messages FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

    CREATE OR REPLACE FUNCTION update_conversation_timestamp() RETURNS TRIGGER AS \$\$
    BEGIN UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id; RETURN NEW; END; \$\$ language 'plpgsql';

    CREATE TRIGGER trg_update_conv_timestamp AFTER INSERT ON messages FOR EACH ROW EXECUTE PROCEDURE update_conversation_timestamp();
EOF

echo "🎉 HOÀN TẤT! Database '$NEW_DB_NAME' đã sẵn sàng trên container '$CONTAINER_NAME'."
