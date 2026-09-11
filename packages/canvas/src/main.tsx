import { buildGithubPermalink, render, THEMES, type Theme } from "@coldtea/pr-lens-renderer/browser";
import { safeParseGraphDoc, type FileRef, type GraphDoc, type WalkthroughStep } from "@coldtea/pr-lens-schema";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type CanvasResponse = {
  id: string;
  document: unknown;
};

type Diagram = {
  id: string;
  title: string;
  lens: "architecture" | "data-flow";
  view?: string;
};

type SourceTarget = {
  id: string;
  files: readonly FileRef[];
  box: { x: number; y: number; width: number; height: number };
};

const canvasId = (): string | undefined =>
  /^\/c\/([A-Za-z0-9_-]{22})$/.exec(window.location.pathname)?.[1];

const fetchCanvas = async (id: string): Promise<GraphDoc> => {
  const response = await fetch(`/api/canvas/${id}`);
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "This canvas is unavailable."
        : "The canvas could not be loaded.",
    );
  const payload: CanvasResponse = await response.json();
  const parsed = safeParseGraphDoc(payload.document);
  if (!parsed.ok) throw new Error("This canvas has an invalid graph document.");
  return parsed.value;
};

const diagramsFor = (graph: GraphDoc): readonly Diagram[] => [
  { id: "architecture", title: graph.title, lens: "architecture" },
  ...graph.views.map((view) => ({
    id: view.id,
    title: view.title,
    lens: view.lens,
    view: view.id,
  })),
  ...graph.flows.map((flow) => ({
    id: `flow:${flow.id}`,
    title: flow.title,
    lens: "data-flow" as const,
    view: flow.id,
  })),
];

const sourceStyle = (box: SourceTarget["box"]): CSSProperties => ({
  left: `${box.x}px`,
  top: `${box.y}px`,
  width: `${box.width}px`,
  height: `${box.height}px`,
});

const SourceOverlay = ({
  graph,
  diagram,
  theme,
  zoom,
  pan,
}: {
  graph: GraphDoc;
  diagram: Diagram;
  theme: Theme;
  zoom: number;
  pan: { x: number; y: number };
}) => {
  const drawing = useMemo(
    () =>
      render(graph, {
        lens: diagram.lens,
        theme,
        ...(diagram.view === undefined ? {} : { view: diagram.view }),
      }),
    [diagram, graph, theme],
  );
  const targets = [
    ...Object.entries(drawing.atlas.sources.nodes).map(([id, files]) => ({
      id: `node:${id}`,
      files,
      box: drawing.atlas.nodes[id],
    })),
    ...Object.entries(drawing.atlas.sources.edges).map(([id, files]) => ({
      id: `edge:${id}`,
      files,
      box: drawing.atlas.edges[id],
    })),
    ...Object.entries(drawing.atlas.sources.messages).flatMap(
      ([flow, messages]) =>
        Object.entries(messages).map(([id, files]) => ({
          id: `message:${flow}:${id}`,
          files,
          box: drawing.atlas.messages[flow]?.[id],
        })),
    ),
  ].filter((target): target is SourceTarget => target.box !== undefined);

  return (
    <div
      className="diagram"
      style={{
        height: drawing.height * zoom,
        width: drawing.width * zoom,
      }}
    >
      <div
        className="diagram-stage"
        style={{
          height: drawing.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: drawing.width,
        }}
      >
        <div className="svg" dangerouslySetInnerHTML={{ __html: drawing.svg }} />
        {targets.map((target) => {
          const source = target.files[0];
          if (source === undefined) return null;
          return (
            <a
              aria-label={`Open ${target.id} source in GitHub`}
              className="source-target"
              href={buildGithubPermalink(graph, source)}
              key={target.id}
              rel="noreferrer"
              style={sourceStyle(target.box)}
              target="_blank"
              title="Open source at the analyzed revision"
            />
          );
        })}
      </div>
    </div>
  );
};

const stageFor = (step: WalkthroughStep): string | undefined => {
  if (step.stage?.kind === "view") return step.stage.view;
  if (step.stage?.kind === "flow") return `flow:${step.stage.flow}`;
  return undefined;
};

const Canvas = ({ graph }: { graph: GraphDoc }) => {
  const diagrams = useMemo(() => diagramsFor(graph), [graph]);
  const [selectedId, setSelectedId] = useState(diagrams[0]?.id ?? "architecture");
  const [theme, setTheme] = useState<Theme>("light");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; pan: { x: number; y: number } }>();
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const selected = diagrams.find((diagram) => diagram.id === selectedId) ?? diagrams[0];
  const walkthrough = graph.walkthrough?.steps ?? [];
  const currentStep = walkthrough[walkthroughStep];

  useEffect(() => {
    if (!walkthroughOpen || walkthrough.length === 0) return undefined;
    const timer = window.setInterval(() => {
      setWalkthroughStep((step) => (step + 1) % walkthrough.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [walkthrough.length, walkthroughOpen]);

  useEffect(() => {
    const stage = currentStep === undefined ? undefined : stageFor(currentStep);
    if (stage !== undefined && diagrams.some((diagram) => diagram.id === stage))
      setSelectedId(stage);
  }, [currentStep, diagrams]);

  if (selected === undefined) return null;

  const zoomBy = (amount: number) =>
    setZoom((value) => Math.min(2.5, Math.max(0.25, Number((value + amount).toFixed(2)))));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const copyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  };
  const move = (event: WheelEvent<HTMLElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 0.1 : -0.1);
  };
  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a") !== null) return;
    setDrag({ x: event.clientX, y: event.clientY, pan });
  };
  const dragCanvas = (event: PointerEvent<HTMLElement>) => {
    if (drag === undefined) return;
    setPan({ x: drag.pan.x + event.clientX - drag.x, y: drag.pan.y + event.clientY - drag.y });
  };

  return (
    <main className="canvas-shell">
      <header className="topbar">
        <div className="identity">
          <h1>{graph.title}</h1>
          <p>
            {graph.provenance.repo.owner}/{graph.provenance.repo.name}
            {graph.provenance.pullRequest === undefined
              ? ""
              : ` #${graph.provenance.pullRequest.number}`}
            <span className="dot">·</span> {diagrams.length} diagrams
          </p>
        </div>
        <div className="toolbar" aria-label="Canvas controls">
          {walkthrough.length > 0 && (
            <button
              className={walkthroughOpen ? "selected" : ""}
              onClick={() => setWalkthroughOpen((open) => !open)}
              type="button"
            >
              Walkthrough <kbd>W</kbd>
            </button>
          )}
          <button aria-label="Zoom out" onClick={() => zoomBy(-0.1)} type="button">
            −
          </button>
          <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
          <button aria-label="Zoom in" onClick={() => zoomBy(0.1)} type="button">
            +
          </button>
          <button onClick={resetView} type="button">
            Fit
          </button>
          <button onClick={() => void copyShareLink()} type="button">
            {shareCopied ? "Copied" : "Share"}
          </button>
          <button aria-label="How to move around" onClick={() => setHelpOpen((open) => !open)} type="button">
            ?
          </button>
          {THEMES.map((candidate) => (
            <button
              className={candidate === theme ? "selected" : ""}
              key={candidate}
              onClick={() => setTheme(candidate)}
              type="button"
            >
              {candidate === "light" ? "☼" : "☾"}
            </button>
          ))}
        </div>
      </header>
      <section
        aria-label="PR Lens canvas"
        className="viewport"
        onPointerCancel={() => setDrag(undefined)}
        onPointerDown={startDrag}
        onPointerMove={dragCanvas}
        onPointerUp={() => setDrag(undefined)}
        onWheel={move}
      >
        <SourceOverlay diagram={selected} graph={graph} pan={pan} theme={theme} zoom={zoom} />
      </section>
      {helpOpen && (
        <aside className="help" aria-label="How to move around">
          <strong>How to move around</strong>
          <p>Drag the canvas to pan. Use Fit to reset. Hold Ctrl while scrolling, or use + and −, to zoom.</p>
        </aside>
      )}
      {walkthroughOpen && currentStep !== undefined && (
        <aside className="walkthrough" aria-label="Walkthrough">
          <strong>
            {String(walkthroughStep + 1).padStart(2, "0")} / {String(walkthrough.length).padStart(2, "0")}
          </strong>
          <h2>{currentStep.heading}</h2>
          <p>{currentStep.body}</p>
          <button onClick={() => setWalkthroughStep((step) => (step + 1) % walkthrough.length)} type="button">
            Next step
          </button>
        </aside>
      )}
      <nav aria-label="Diagrams on this canvas" className="strip">
        {diagrams.map((diagram) => (
          <button
            className={diagram.id === selected.id ? "active" : ""}
            key={diagram.id}
            onClick={() => {
              setSelectedId(diagram.id);
              resetView();
            }}
            type="button"
          >
            <span>{diagram.title}</span>
            <small>{diagram.lens}</small>
          </button>
        ))}
      </nav>
    </main>
  );
};

const App = () => {
  const id = canvasId();
  const [state, setState] = useState<{ graph?: GraphDoc; error?: string }>(
    id === undefined ? { error: "A canvas id is required." } : {},
  );

  useEffect(() => {
    if (id === undefined) return;
    void fetchCanvas(id).then(
      (graph) => setState({ graph }),
      (error: unknown) =>
        setState({
          error:
            error instanceof Error
              ? error.message
              : "The canvas could not be loaded.",
        }),
    );
  }, [id]);

  if (state.error !== undefined) return <p className="message">{state.error}</p>;
  if (state.graph === undefined) return <p className="message">Loading canvas…</p>;
  return <Canvas graph={state.graph} />;
};

createRoot(document.getElementById("root")!).render(<App />);
