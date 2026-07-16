'use client';

import Image from 'next/image';

export function BrandLogo({
  size = 32,
  className = '',
  showWordmark = false,
  wordmarkClassName = '',
}: {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/gchq-logo.png"
        alt="GCHQ"
        width={size}
        height={size}
        className="object-contain shrink-0 rounded-md"
        priority
      />
      {showWordmark && (
        <div className={wordmarkClassName}>
          <div className="font-bold tracking-tight leading-none">GCHQ</div>
          <div className="text-[10px] font-medium opacity-70 leading-tight mt-0.5">
            Green Corridor Headquarters
          </div>
        </div>
      )}
    </div>
  );
}
