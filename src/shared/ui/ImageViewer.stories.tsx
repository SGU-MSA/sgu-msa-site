import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ImageViewer, type ViewerImage } from "./ImageViewer";
import { ImageViewerGallery } from "./ImageViewerGallery";

/*
 * Sample pictures only: the two site placeholders and plain drawn shapes in
 * different shapes (wide, tall, square). No real photographs: inherited photos
 * are not approved for display (docs/guides/photography.md).
 */
function sample(width: number, height: number, sky: string, hill: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${sky}"/><circle cx="${width * 0.72}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.09}" fill="#f6f3ec" fill-opacity=".7"/><path d="M0 ${height * 0.72} Q${width * 0.3} ${height * 0.5} ${width * 0.55} ${height * 0.68} T${width} ${height * 0.62} V${height} H0Z" fill="${hill}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const PHOTOS: ViewerImage[] = [
  {
    src: "/images/placeholder/garment.svg",
    alt: "Sample garment drawing, front, on a dark backdrop",
    width: 800,
    height: 800,
  },
  {
    src: sample(1200, 800, "#9fb3a6", "#1f3d33"),
    alt: "Sample picture: green hills under a pale sky",
    width: 1200,
    height: 800,
  },
  {
    src: sample(800, 1200, "#c9b994", "#5b4a2e"),
    alt: "Sample picture, portrait: a brown ridge under a sand-coloured sky",
    width: 800,
    height: 1200,
  },
  {
    src: "/images/placeholder/editorial.svg",
    alt: "The site's editorial placeholder pattern",
    width: 1200,
    height: 800,
  },
  {
    src: sample(1600, 900, "#7f93a8", "#24221e"),
    alt: "Sample picture, wide: a dark shoreline under a blue-grey sky",
    width: 1600,
    height: 900,
  },
];

const CAPTIONS = [
  "Front. Sizes S to XL.",
  "A caption is optional and shown only when given.",
  "Tall photos keep their shape.",
  "",
  "Wide photos fill the width.",
];

const CAPTIONED: ViewerImage[] = PHOTOS.map((photo, i) =>
  CAPTIONS[i] ? { ...photo, caption: CAPTIONS[i] } : photo,
);

/** The viewer open on `start`, with a button to open it again after closing. */
function Open({
  images,
  start = 0,
  label,
}: {
  images: ViewerImage[];
  start?: number;
  label?: string;
}) {
  const [index, setIndex] = useState<number | null>(start);
  return (
    <>
      <button type="button" onClick={() => setIndex(start)}>
        Open the viewer
      </button>
      <ImageViewer
        images={images}
        index={index}
        onIndexChange={setIndex}
        label={label}
      />
    </>
  );
}

const meta = {
  title: "Primitives/ImageViewer",
  component: Open,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Open>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Several photos, no captions (merch): photo, counter, arrows and the strip. */
export const SeveralPhotos: Story = {
  args: { images: PHOTOS, start: 1, label: "Shukr long-sleeve" },
};
export const SeveralPhotosDark: Story = {
  ...SeveralPhotos,
  globals: { theme: "dark" },
};

/** Several photos where some have a caption; the fourth has none. */
export const SeveralWithCaptions: Story = {
  args: { images: CAPTIONED, start: 0, label: "Event photos" },
};
export const SeveralWithCaptionsDark: Story = {
  ...SeveralWithCaptions,
  globals: { theme: "dark" },
};

/** One photo: just the photo and Close (no strip, arrows or counter). */
export const SinglePhoto: Story = {
  args: { images: [PHOTOS[1]] },
};
export const SinglePhotoDark: Story = {
  ...SinglePhoto,
  globals: { theme: "dark" },
};

/** One photo with a caption under it. */
export const SingleWithCaption: Story = {
  args: { images: [CAPTIONED[2]] },
};
export const SingleWithCaptionDark: Story = {
  ...SingleWithCaption,
  globals: { theme: "dark" },
};

/** The thumbnails, closed: each opens the viewer on its photo. */
export const GalleryClosed: Story = {
  args: { images: PHOTOS },
  parameters: { layout: "padded" },
  render: ({ images }) => (
    <ImageViewerGallery images={images} label="Shukr long-sleeve" />
  ),
};
export const GalleryClosedDark: Story = {
  ...GalleryClosed,
  globals: { theme: "dark" },
};
