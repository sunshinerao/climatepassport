import React from "react";

interface MockNextImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number | string;
  height?: number | string;
  priority?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
  loader?: (resolver: { src: string; width: number; quality?: number }) => string;
  layout?: string;
  objectFit?: string;
  objectPosition?: string;
  loading?: "eager" | "lazy";
  unoptimized?: boolean;
}

const MockNextImage = React.forwardRef<HTMLImageElement, MockNextImageProps>(
  ({ src, alt, fill, width, height, style, ...props }, ref) => {
    const fillStyle: React.CSSProperties = fill
      ? {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }
      : {};
    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        style={{ ...fillStyle, ...style }}
        {...props}
      />
    );
  }
);

MockNextImage.displayName = "MockNextImage";
export default MockNextImage;
