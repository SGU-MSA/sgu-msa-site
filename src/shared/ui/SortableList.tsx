"use client";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { moveItem } from "@/lib/community/order";
import { systemText } from "@/lib/system-text";
import { cn } from "./cn";
import styles from "./SortableList.module.css";

const words = systemText.order;

export type SortableListProps<T> = {
  /** The items in their current order; the same objects across renders. */
  items: readonly T[];
  /** A stable key per item (its id). */
  itemKey: (item: T) => string;
  /** The item's name for its handle and the announcement. */
  itemName: (item: T, index: number) => string;
  /** The new order, after a drag or an arrow key. Saving it is the caller's. */
  onReorder: (items: T[]) => void;
  /** One item's own content (name, badges, Edit, or a whole form). */
  children: (item: T, index: number) => ReactNode;
  /** The list's accessible name, such as the group it orders. */
  label: string;
  /** `rows`: lines on the page, like a board list; `cards`: boxed items. */
  look?: "rows" | "cards";
  className?: string;
};

/**
 * The one list the board puts in order (review fixes PR-2; review 2): drag an
 * item by its handle ⠿ (mouse, finger or pen, Motion's `Reorder`). The
 * handle is also a button: focused, the up and down arrow keys move its item
 * one place and the new place is read out, so keyboards and screen readers
 * reorder without visible arrows. It only reorders what it is given; the
 * caller saves the order with one action (or with its form).
 */
export function SortableList<T>({
  items,
  itemKey,
  itemName,
  onReorder,
  children,
  label,
  look = "rows",
  className,
}: SortableListProps<T>) {
  const [announcement, setAnnouncement] = useState("");
  const keysHint = useId();
  const handles = useRef(new Map<string, HTMLButtonElement | null>());
  // After the keyboard moves an item, its handle keeps the focus (moving a
  // focused element in the page can drop it).
  const [moved, setMoved] = useState<string | null>(null);
  useEffect(() => {
    if (!moved) return;
    const handle = handles.current.get(moved);
    if (handle && document.activeElement !== handle) handle.focus();
  }, [moved, items]);

  const move = (index: number, to: number) => {
    if (to < 0 || to >= items.length || to === index) return;
    const item = items[index];
    onReorder(moveItem(items, index, to));
    setMoved(itemKey(item));
    setAnnouncement(words.moved(itemName(item, to), to + 1, items.length));
  };

  return (
    <div className={cn(styles.sortable, className)}>
      <Reorder.Group
        as="ol"
        axis="y"
        values={items as T[]}
        onReorder={onReorder}
        className={styles.list}
        aria-label={label}
        data-look={look}
        data-single={items.length < 2 ? "" : undefined}
      >
        {items.map((item, index) => {
          const key = itemKey(item);
          return (
            <SortableItem
              key={key}
              item={item}
              name={itemName(item, index)}
              keysHint={keysHint}
              onKey={(event) => {
                const to = {
                  ArrowUp: index - 1,
                  ArrowDown: index + 1,
                  Home: 0,
                  End: items.length - 1,
                }[event.key];
                if (to === undefined) return;
                event.preventDefault();
                move(index, to);
              }}
              handleRef={(button) => {
                handles.current.set(key, button);
              }}
            >
              {children(item, index)}
            </SortableItem>
          );
        })}
      </Reorder.Group>
      <p id={keysHint} hidden>
        {words.keys}
      </p>
      {/* A live region without the status role, so it never competes with a page's own message. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

function SortableItem<T>({
  item,
  name,
  keysHint,
  onKey,
  handleRef,
  children,
}: {
  item: T;
  name: string;
  /** The id of the line that says how to move it with the keyboard. */
  keysHint: string;
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  handleRef: (button: HTMLButtonElement | null) => void;
  children: ReactNode;
}) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  return (
    <Reorder.Item
      as="li"
      value={item}
      dragListener={false}
      dragControls={controls}
      className={styles.item}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      data-dragging={dragging ? "" : undefined}
      data-sortable-item=""
    >
      {/* Dragged with a pointer; focused, moved with the arrow keys. */}
      <button
        type="button"
        ref={handleRef}
        className={styles.handle}
        aria-label={words.handle(name)}
        aria-describedby={keysHint}
        title={words.handle(name)}
        data-drag-handle=""
        onKeyDown={onKey}
        onPointerDown={(event) => {
          event.preventDefault();
          controls.start(event);
        }}
      >
        <GripVertical aria-hidden="true" size={20} strokeWidth={1.75} />
      </button>
      <div className={styles.content}>{children}</div>
    </Reorder.Item>
  );
}
