import type { HTMLAttributes } from "react";

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section";
};

export function Container({
  as: Tag = "div",
  className = "",
  ...props
}: ContainerProps) {
  return (
    <Tag
      className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 ${className}`}
      {...props}
    />
  );
}
