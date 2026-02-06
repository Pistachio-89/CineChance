'use client';

import { useState, useEffect } from 'react';
import { Tag as TagIcon, Music } from 'lucide-react';
import Link from 'next/link';

interface TagUsage {
  id: string;
  name: string;
  count: number;
}

interface GenreData {
  id: number;
  name: string;
  count: number;
}

function TagsGenresSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
        <div className="h-5 w-32 bg-gray-700 rounded mb-3"></div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-gray-700 rounded w-2/3"></div>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
        <div className="h-5 w-32 bg-gray-700 rounded mb-3"></div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-gray-700 rounded w-2/3"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfileTagsGenres() {
  const [tags, setTags] = useState<TagUsage[]>([]);
  const [genres, setGenres] = useState<GenreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем теги и жанры параллельно
        const [tagsRes, genresRes] = await Promise.all([
          fetch('/api/user/tag-usage?limit=10'),
          fetch('/api/user/genres?statuses=watched,rewatched&limit=50'),
        ]);

        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setTags(data.tags || []);
        }

        if (genresRes.ok) {
          const data = await genresRes.json();
          setGenres((data.genres || []).slice(0, 10));
        }
      } catch (error) {
        console.error('Error loading tags and genres:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return <TagsGenresSkeleton />;
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* Теги */}
      {tags.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold text-white">Теги</h2>
          </div>

          <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
            <div className="space-y-2">
              {tags.map(tag => (
                <Link
                  key={tag.id}
                  href={`/stats/tags/${tag.id}?source=tags`}
                  className="block p-2 rounded-lg hover:bg-gray-800 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base text-white font-medium">{tag.name}</span>
                    <span className="text-xs md:text-sm text-gray-500">{tag.count}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Жанры */}
      {genres.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Жанры</h2>
          </div>

          <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
            <div className="space-y-2">
              {genres.map(genre => (
                <Link
                  key={genre.id}
                  href={`/stats/genres/${genre.id}?source=genres`}
                  className="block p-2 rounded-lg hover:bg-gray-800 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base text-white font-medium">{genre.name}</span>
                    <span className="text-xs md:text-sm text-gray-500">{genre.count}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
