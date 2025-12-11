type MessageHandler = (message: any) => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private messageHandlers: MessageHandler[] = [];
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private token: string | null = null;
    private isExplicitDisconnect = false;

    connect(token: string) {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        this.token = token;
        this.isExplicitDisconnect = false;

        // Use relative path or env var for WS URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = 'localhost:8000'; // TODO: Make dynamic
        const wsUrl = `${protocol}//${host}/api/v1/chats/ws?token=${token}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.messageHandlers.forEach(handler => handler(data));
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            if (!this.isExplicitDisconnect) {
                this.attemptReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.ws?.close();
        };
    }

    disconnect() {
        this.isExplicitDisconnect = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    addMessageHandler(handler: MessageHandler) {
        this.messageHandlers.push(handler);
        return () => {
            this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
        };
    }

    private attemptReconnect() {
        if (this.reconnectTimeout) return;

        console.log('Attempting to reconnect WebSocket in 3s...');
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.token) {
                this.connect(this.token);
            }
        }, 3000);
    }
}

export const webSocketService = new WebSocketService();
