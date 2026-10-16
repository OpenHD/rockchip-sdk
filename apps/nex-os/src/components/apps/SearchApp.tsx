import React, { useState } from 'react';
import {
  Search24Regular,
  DocumentPdf20Regular,
  Image20Regular,
  Video20Regular,
  Document20Regular,
  Folder20Regular,
  Clock24Regular,
  Delete24Regular,
} from '@fluentui/react-icons';

interface SearchResult {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'app';
  path: string;
  modified: string;
  icon: React.ReactNode;
}

const SearchApp: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState(['React', 'Windows', 'TypeScript']);
  const [searchHistory, setSearchHistory] = useState([
    { id: '1', name: 'README.md', path: 'C:\\Users\\User\\Documents', date: 'Hace 1 hora' },
    { id: '2', name: 'photo.jpg', path: 'C:\\Users\\User\\Pictures', date: 'Hace 2 horas' },
    { id: '3', name: 'index.tsx', path: 'C:\\Projects\\windows\\src', date: 'Hace 3 horas' },
  ]);

  const mockFiles: SearchResult[] = [
    {
      id: '1',
      name: 'Presentation.pptx',
      type: 'file',
      path: 'C:\\Users\\User\\Documents',
      modified: '15/03/2026',
      icon: <Document20Regular />,
    },
    {
      id: '2',
      name: 'wallpaper.jpg',
      type: 'file',
      path: 'C:\\Users\\User\\Pictures',
      modified: '01/03/2026',
      icon: <Image20Regular />,
    },
    {
      id: '3',
      name: 'Budget.xlsx',
      type: 'file',
      path: 'C:\\Users\\User\\Documents',
      modified: '22/03/2026',
      icon: <Document20Regular />,
    },
    {
      id: '4',
      name: 'Projects',
      type: 'folder',
      path: 'C:\\Users\\User\\Documents',
      modified: '26/03/2026',
      icon: <Folder20Regular />,
    },
    {
      id: '5',
      name: 'movie.mp4',
      type: 'file',
      path: 'C:\\Users\\User\\Videos',
      modified: '10/03/2026',
      icon: <Video20Regular />,
    },
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setResults([]);
      return;
    }

    const filtered = mockFiles.filter(
      (file) =>
        file.name.toLowerCase().includes(query.toLowerCase()) ||
        file.path.toLowerCase().includes(query.toLowerCase())
    );

    setResults(filtered);

    if (!recentSearches.includes(query)) {
      setRecentSearches([query, ...recentSearches.slice(0, 4)]);
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search Header */}
      <div className="bg-gradient-to-b from-blue-500 to-blue-400 text-white p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Buscar en tu PC</h1>
          <div className="relative">
            <Search24Regular className="absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Busca archivos, carpetas, aplicaciones..."
              className="w-full pl-10 pr-4 py-2 rounded-full text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {searchQuery ? (
            <>
              {results.length > 0 ? (
                <>
                  <h2 className="text-lg font-bold mb-4">
                    Resultados para "{searchQuery}" ({results.length})
                  </h2>
                  <div className="space-y-2">
                    {results.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-start gap-3 p-3 hover:bg-gray-100 rounded cursor-pointer"
                      >
                        <div className="text-blue-600 flex-shrink-0">{result.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800">{result.name}</p>
                          <p className="text-sm text-gray-500">{result.path}</p>
                        </div>
                        <p className="text-xs text-gray-500 flex-shrink-0">{result.modified}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Search24Regular className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No se encontraron resultados</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold mb-4">Búsquedas recientes</h2>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearch(search)}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search History */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Historial reciente</h2>
                  {searchHistory.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="text-sm text-blue-600 hover:text-blue-800 flex gap-1 items-center"
                    >
                      <Delete24Regular /> Limpiar
                    </button>
                  )}
                </div>
                {searchHistory.length > 0 ? (
                  <div className="space-y-2">
                    {searchHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded cursor-pointer"
                      >
                        <Clock24Regular className="text-gray-400" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.path}</p>
                        </div>
                        <p className="text-xs text-gray-500">{item.date}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Sin historial</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchApp;
