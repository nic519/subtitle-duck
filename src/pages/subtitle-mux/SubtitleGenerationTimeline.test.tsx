import { expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement } from "react";
import { SubtitleGenerationTimeline } from "./SubtitleGenerationTimeline";

const elements = (element: ReactElement): ReactElement<any>[] => [
  element,
  ...Children.toArray((element.props as { children?: React.ReactNode }).children)
    .flatMap((child) => isValidElement(child) ? elements(child) : []),
];

test("seeking inside a chosen range also selects it without blocking the slider", () => {
  let sought = 0;
  let selected = "";
  const tree = SubtitleGenerationTimeline({
    durationMs: 60_000, playheadMs: 10_000,
    segments: [{ id: "chosen", startMs: 20_000, endMs: 60_000 }],
    activeSegmentId: null, disabled: false,
    onSelectSegment: (id) => { selected = id; },
    onRemoveSegment: () => {}, onTogglePlayback: () => {},
    onSeek: (time) => { sought = time; },
  });
  const nodes = elements(tree);
  const slider = nodes.find((node) => node.type === "input")!;
  const range = nodes.find((node) => node.props["data-subtitle-generation-segment"] === "chosen")!;
  const layer = (node: ReactElement<any>) => Number(node.props.className.match(/\bz-(\d+)\b/)[1]);
  expect(layer(slider)).toBeGreaterThan(layer(range));
  slider.props.onChange({ target: { value: "39000" } });
  expect(sought).toBe(39_000);
  expect(selected).toBe("chosen");
  slider.props.onChange({ target: { value: "9000" } });
  expect(sought).toBe(9_000);
  expect(selected).toBe("chosen");
});
