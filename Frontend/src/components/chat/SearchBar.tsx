import { Search } from 'lucide-react';
import type { User } from '../../types';

interface SearchBarProps {
    searchQuery: string;
    onChange: (query: string) => void;
    searchResults: User[];
    onUserSelect: (user: User) => void;
    showResults: boolean;
    setShowResults: (show: boolean) => void;
    isSearching: boolean;
}

export const SearchBar = ({
    searchQuery,
    onChange,
    searchResults,
    onUserSelect,
    showResults,
    setShowResults,
    isSearching
}: SearchBarProps) => (
    <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="w-full rounded-full bg-gray-100 py-2 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2AABEE]"
        />

        {/* Search Results Dropdown */}
        {showResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 z-50 max-h-64 overflow-y-auto">
                {!searchQuery && searchResults.length > 0 && (
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                        Suggested Users
                    </div>
                )}

                {isSearching ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                ) : searchResults.length > 0 ? (
                    searchResults.map(result => (
                        <div
                            key={result.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onUserSelect(result)}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#2AABEE] text-white flex items-center justify-center text-sm font-medium">
                                {result.avatar ? (
                                    <img src={result.avatar} alt={result.username} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    result.username.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{result.username}</span>
                            </div>
                        </div>
                    ))
                ) : searchQuery ? (
                    <div className="p-4 text-center text-gray-500 text-sm">User not found</div>
                ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">No users available</div>
                )}
            </div>
        )}
    </div>
);
