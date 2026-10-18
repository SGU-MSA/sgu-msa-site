import { Shirt } from "lucide-react";

import type {
  MerchCollectionView,
  MerchItemView,
  MerchPageData,
} from "@/lib/community/merch";
import type { MerchContent } from "@/lib/content/schemas";
import { Container } from "@/shared/ui/Container";
import { SafeImage } from "@/shared/ui/SafeImage";
import { InkHeading } from "@/shared/ui/InkHeading";
import quiet from "@/shared/ui/page.module.css";

import { ArabicName, Details, Photo, SizeButtons, Thumbs } from "./MerchParts";
import s from "./merch.module.css";

/** The page's fixed words (PR5c): new wording, on the release checklist. */
const words = {
  empty: "Collections will be published here.",
  unavailable:
    "The collections can't be shown right now. Please try again in a few minutes.",
  lead: "Current collection",
  past: "Not for sale",
  archive: "The archive",
  more: "More collections",
};

/**
 * /merch, "Now Wearing" (PR8 D-7; PR5c from the dashboard): the page's
 * opening (page text `merch`), then the current collection on layered
 * paper with each item's photos (the shared photo viewer), details and
 * "See price and buy ↗" per size; every other collection follows, in the
 * board's order, as a quieter page marked "Not for sale" when past. No
 * price, stock or Go2Pay address on our page (P-72 B). No verse (ADR 0018).
 */
export function NowWearing({
  content,
  data,
}: {
  content: MerchContent;
  data: MerchPageData;
}) {
  const { hero, garment_note: garmentNote } = content;
  return (
    <Container className={`${quiet.above} ${s.main}`}>
      <header className={`${s.hero} ${quiet.enter}`}>
        <div className={s.heroText}>
          {hero.eyebrow ? (
            <p className={quiet.eyebrow}>{hero.eyebrow}</p>
          ) : null}
          <h1 className={`${quiet.display} ${s.display}`}>{hero.title}</h1>
          {hero.description ? (
            <p className={s.heroSub}>{hero.description}</p>
          ) : null}
          {garmentNote ? (
            <p className={s.garmentNote}>
              <Shirt
                aria-hidden="true"
                className={s.shirt}
                strokeWidth={1.35}
              />
              {garmentNote}
            </p>
          ) : null}
        </div>
        {hero.image ? (
          <div className={s.heroImage}>
            <SafeImage
              image={hero.image}
              fill
              priority
              sizes="(min-width: 960px) 28vw, 100vw"
              fit="cover"
            />
          </div>
        ) : null}
      </header>

      {data.state === "unavailable" ? (
        <p className={s.empty} role="status">
          {words.unavailable}
        </p>
      ) : (
        <>
          {data.lead || data.others.length ? null : (
            <p className={s.empty}>{words.empty}</p>
          )}
          {data.lead ? <LeadCollection collection={data.lead} /> : null}
          {data.others.length ? (
            <section aria-labelledby="merch-more" className={s.more}>
              <InkHeading
                id="merch-more"
                text={
                  data.others.every((other) => other.era === "past")
                    ? words.archive
                    : words.more
                }
                className={quiet.h2Small}
                inline
              />
              <div className={s.pages}>
                {data.others.map((collection) => (
                  <OtherCollection
                    key={collection.id}
                    collection={collection}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </Container>
  );
}

/** Every photo of a collection's items, in order (the first item's cover first). */
const photosOf = (collection: MerchCollectionView) =>
  collection.items.flatMap((item) => item.photos);

function LeadCollection({ collection }: { collection: MerchCollectionView }) {
  const [cover] = photosOf(collection);
  return (
    <section
      id={`collection-${collection.id}`}
      aria-labelledby={`collection-${collection.id}-heading`}
      className={s.feature}
    >
      <div className={s.featureMedia}>
        {cover ? (
          <div className={quiet.photo}>
            <Photo
              photo={cover}
              className={s.featureLead}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        ) : null}
      </div>
      <div className={s.featureText}>
        <p className={s.kicker}>{words.lead}</p>
        <h2
          id={`collection-${collection.id}-heading`}
          className={s.featureName}
        >
          {collection.name}
        </h2>
        <ArabicName text={collection.arabic} size="lg" />
        {collection.quote ? (
          <p className={s.quote}>“{collection.quote}”</p>
        ) : null}
        {collection.description ? (
          <p className={s.body}>{collection.description}</p>
        ) : null}
      </div>
      {collection.items.length ? (
        <ul className={s.items}>
          {collection.items.map((item) => (
            <ItemEntry key={item.id} item={item} year={collection.year} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** One item of the current collection: its photos, words, details and sizes. */
function ItemEntry({ item, year }: { item: MerchItemView; year: string }) {
  return (
    <li className={s.item}>
      <h3 className={s.h3}>{item.name}</h3>
      {item.description ? (
        <p className={s.bodySmall}>{item.description}</p>
      ) : null}
      <Details garment={item.garment} colorway={item.colorway} year={year} />
      <SizeButtons sizes={item.sizes} itemName={item.name} />
      <Thumbs photos={item.photos} label={item.name} className={s.itemPhotos} />
    </li>
  );
}

function OtherCollection({ collection }: { collection: MerchCollectionView }) {
  const [lead, ...rest] = photosOf(collection);
  return (
    <article
      id={`collection-${collection.id}`}
      aria-labelledby={`collection-${collection.id}-heading`}
      className={s.page}
    >
      {lead ? (
        <Photo
          photo={lead}
          className={s.pageLead}
          sizes="(min-width: 1024px) 34vw, 100vw"
        />
      ) : null}
      {rest.length ? (
        <Thumbs
          photos={rest.slice(0, 4)}
          label={collection.name}
          className={s.mini}
        />
      ) : null}
      {collection.era === "past" ? (
        <p className={s.kicker}>{words.past}</p>
      ) : null}
      <h3 id={`collection-${collection.id}-heading`} className={s.h3}>
        {collection.name}
      </h3>
      <ArabicName text={collection.arabic} size="sm" />
      {collection.quote ? (
        <p className={s.quoteSmall}>“{collection.quote}”</p>
      ) : null}
      {collection.description ? (
        <p className={s.bodySmall}>{collection.description}</p>
      ) : null}
      {collection.items.map((item) => (
        <div key={item.id} className={s.otherItem}>
          {collection.items.length > 1 ? (
            <p className={s.otherName}>{item.name}</p>
          ) : null}
          {item.description ? (
            <p className={s.bodySmall}>{item.description}</p>
          ) : null}
          <Details
            garment={item.garment}
            colorway={item.colorway}
            year={collection.year}
          />
          <SizeButtons sizes={item.sizes} itemName={item.name} />
        </div>
      ))}
    </article>
  );
}
