'use client';

const VARIANTS = {
  green: 'bg-telnyx-green hover:bg-[#008c69] text-white',
  red: 'bg-red-600 hover:bg-red-700 text-white',
  gray: 'bg-gray-700 hover:bg-gray-600 text-white',
  outline: 'border border-gray-500 text-gray-300 hover:bg-gray-700',
};

export default function CircleButton({
  children,
  variant = 'gray',
  size = 48,
  disabled = false,
  onClick,
  title,
  className = '',
  pulse = false,
}) {
  const sizeClass = size === 32 ? 'h-8 w-8' : 'h-12 w-12';
  const iconSize = size === 32 ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        ${sizeClass} flex items-center justify-center rounded-full
        transition-all duration-150
        ${VARIANTS[variant] || VARIANTS.gray}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        ${pulse ? 'call-pulse' : ''}
        ${className}
      `}
    >
      <span className={iconSize}>{children}</span>
    </button>
  );
}
