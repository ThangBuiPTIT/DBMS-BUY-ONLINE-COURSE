import React from 'react';
import { BookOpen, Users, Star, Clock, ChevronRight } from 'lucide-react';

/**
 * CourseCard.jsx — Áp dụng bộ màu "Modern Education"
 * Sử dụng các token màu đã định nghĩa trong index.css @theme:
 *   bg-surface, border-divider, text-heading, text-body,
 *   text-muted, bg-primary-light, text-primary, bg-primary, ...
 */
export default function CourseCard({ course }) {
  const {
    thumbnail,
    category,
    title,
    instructor,
    rating,
    reviewCount,
    students,
    duration,
    price,
    originalPrice,
    progress,
    level = 'Cơ bản',
  } = course;

  const levelColors = {
    'Cơ bản':    'bg-emerald-50 text-emerald-700',
    'Trung cấp': 'bg-amber-50   text-amber-700',
    'Nâng cao':  'bg-rose-50    text-rose-700',
  };

  return (
    <article className="card group flex flex-col overflow-hidden cursor-pointer">

      {/* --- Thumbnail --- */}
      <div className="relative overflow-hidden aspect-video bg-base">
        <img
          src={thumbnail || 'https://placehold.co/640x360/eff6ff/2563eb?text=Course'}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Category badge */}
        <span className="absolute top-3 left-3 badge-primary">
          {category}
        </span>
        {/* Level badge */}
        <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${levelColors[level] || levelColors['Cơ bản']}`}>
          {level}
        </span>
      </div>

      {/* --- Body --- */}
      <div className="flex flex-col flex-1 p-5 gap-3">

        {/* Title */}
        <h3 className="text-heading font-bold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>

        {/* Instructor */}
        <p className="text-muted text-sm flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          {instructor}
        </p>

        {/* Rating + Students */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-amber-500 font-semibold">
            <Star className="w-4 h-4 fill-amber-400" />
            {rating?.toFixed(1)}
            <span className="text-muted font-normal">({reviewCount?.toLocaleString()})</span>
          </span>
          <span className="flex items-center gap-1 text-muted">
            <Users className="w-3.5 h-3.5" />
            {students?.toLocaleString()} học viên
          </span>
        </div>

        {/* Duration */}
        <p className="text-muted text-xs flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {duration}
        </p>

        {/* Progress bar (shown when student is enrolled) */}
        {typeof progress === 'number' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted">
              <span>Tiến độ học</span>
              <span className="text-primary font-semibold">{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Divider */}
        <div className="divider pt-1" />

        {/* Footer: Price + CTA */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {price === 0 ? (
              <span className="text-primary font-extrabold text-lg">Miễn phí</span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-heading font-extrabold text-lg">
                  {price?.toLocaleString('vi-VN')}₫
                </span>
                {originalPrice && (
                  <span className="text-muted text-xs line-through">
                    {originalPrice?.toLocaleString('vi-VN')}₫
                  </span>
                )}
              </div>
            )}
          </div>

          <button className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4">
            Xem khóa học
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
