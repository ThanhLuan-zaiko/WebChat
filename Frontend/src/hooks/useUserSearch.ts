import { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import type { User } from '../types';

export const useUserSearch = (onUserSelect: (user: User) => void) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // Search users
    useEffect(() => {
        const searchUsers = async () => {
            setIsSearching(true);
            try {
                const results = await userService.searchUsers(searchQuery);
                setSearchResults(results);
            } catch (error) {
                console.error("Failed to search users:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const handleUserSelect = (selectedUser: User) => {
        // Close search results
        setShowSearchResults(false);
        setSearchQuery('');

        // Call parent handler
        onUserSelect(selectedUser);
    };

    return {
        searchQuery,
        searchResults,
        isSearching,
        showSearchResults,
        setSearchQuery,
        setShowSearchResults,
        handleUserSelect,
    };
};
