"use client";

import { Eraser } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { TraceSignature } from "@/types/database";

/*
  Pavé de signature vectoriel : le tracé est enregistré en {vb, d[]}, lissé par des courbes
  passant par le milieu des points successifs. Doigt, souris, pavé tactile ou stylet (pointer events).
  Au clavier : les flèches tracent, Entrée lève le stylo.
*/

type Point = { x: number; y: number };

const ENCRE = "#14212B";
const EPAISSEUR = 2.6;
const PAS_CLAVIER = 8;
const ECART_MIN = 1.5;

const f = (v: number) => String(Math.round(v * 10) / 10);

/* Chemin lissé : M p0, puis Q p(i-1) milieu(p(i-1), p(i)), et L jusqu'au dernier point */
function chemin(points: Point[]): string {
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    d += ` Q${f(a.x)} ${f(a.y)} ${f((a.x + b.x) / 2)} ${f((a.y + b.y) / 2)}`;
  }
  const fin = points[points.length - 1];
  return `${d} L${f(fin.x)} ${f(fin.y)}`;
}

export function PaveSignature({
  initiale,
  onChange,
}: {
  initiale: TraceSignature | null;
  onChange: (trace: TraceSignature | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  /* Repère du tracé (taille du cadre au premier affichage) et traits terminés */
  const etat = useRef<{ vb: { w: number; h: number } | null; traits: string[]; points: Point[]; actif: boolean; milieu: Point | null }>({
    vb: null,
    traits: [],
    points: [],
    actif: false,
    milieu: null,
  });
  const [vide, setVide] = useState(!initiale);
  const description = useId();

  /* Échelle entre le repère du tracé et la taille affichée du cadre */
  const echelle = () => {
    const c = canvas.current;
    const vb = etat.current.vb;
    if (!c || !vb) return 1;
    return c.getBoundingClientRect().width / vb.w;
  };

  const contexte = () => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return null;
    const ratio = window.devicePixelRatio || 1;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.strokeStyle = ENCRE;
    g.lineWidth = EPAISSEUR;
    g.lineCap = "round";
    g.lineJoin = "round";
    return g;
  };

  /* Taille du cadre, puis nouveau dessin des traits déjà faits */
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const e = etat.current;
    if (initiale && !e.traits.length) {
      const [, , w, h] = initiale.vb.split(" ").map(Number);
      e.vb = { w, h };
      e.traits = [...initiale.d];
    }
    const redessiner = () => {
      const rect = c.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = window.devicePixelRatio || 1;
      c.width = Math.round(rect.width * ratio);
      c.height = Math.round(rect.height * ratio);
      if (!e.vb) e.vb = { w: Math.round(rect.width), h: Math.round(rect.height) };
      const g = contexte();
      if (!g) return;
      const k = rect.width / e.vb.w;
      g.save();
      g.scale(k, k);
      e.traits.forEach((d) => g.stroke(new Path2D(d)));
      g.restore();
    };
    redessiner();
    const observateur = new ResizeObserver(redessiner);
    observateur.observe(c);
    return () => observateur.disconnect();
    /* initiale n'est lue qu'au premier affichage */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publier = () => {
    const e = etat.current;
    if (!e.vb || !e.traits.length) return onChange(null);
    onChange({ vb: `0 0 ${e.vb.w} ${e.vb.h}`, d: [...e.traits] });
  };

  const commencer = (p: Point) => {
    const e = etat.current;
    e.actif = true;
    e.points = [p];
    e.milieu = p;
  };

  const prolonger = (brut: Point) => {
    const e = etat.current;
    const p = e.vb ? { x: Math.min(e.vb.w, Math.max(0, brut.x)), y: Math.min(e.vb.h, Math.max(0, brut.y)) } : brut;
    const dernier = e.points[e.points.length - 1];
    if (Math.hypot(p.x - dernier.x, p.y - dernier.y) < ECART_MIN) return;
    e.points.push(p);
    const milieu = { x: (dernier.x + p.x) / 2, y: (dernier.y + p.y) / 2 };
    const g = contexte();
    if (g && e.milieu) {
      const k = echelle();
      g.beginPath();
      g.moveTo(e.milieu.x * k, e.milieu.y * k);
      g.quadraticCurveTo(dernier.x * k, dernier.y * k, milieu.x * k, milieu.y * k);
      g.stroke();
    }
    e.milieu = milieu;
  };

  const terminer = () => {
    const e = etat.current;
    if (!e.actif) return;
    e.actif = false;
    if (e.points.length > 1 && e.traits.length < 80) {
      e.traits.push(chemin(e.points));
      setVide(false);
      publier();
    }
    e.points = [];
    e.milieu = null;
  };

  const position = (ev: PointerEvent<HTMLCanvasElement>): Point => {
    const r = ev.currentTarget.getBoundingClientRect();
    const k = echelle();
    return { x: (ev.clientX - r.left) / k, y: (ev.clientY - r.top) / k };
  };

  const effacer = () => {
    const e = etat.current;
    e.traits = [];
    e.points = [];
    e.actif = false;
    const c = canvas.current;
    const g = contexte();
    if (c && g) g.clearRect(0, 0, c.width, c.height);
    setVide(true);
    onChange(null);
  };

  /* Clavier : les flèches prolongent le trait, Entrée ou Espace lève le stylo */
  const clavier = (ev: KeyboardEvent<HTMLCanvasElement>) => {
    const e = etat.current;
    const directions: Record<string, Point> = {
      ArrowRight: { x: PAS_CLAVIER, y: 0 },
      ArrowLeft: { x: -PAS_CLAVIER, y: 0 },
      ArrowUp: { x: 0, y: -PAS_CLAVIER },
      ArrowDown: { x: 0, y: PAS_CLAVIER },
    };
    const dir = directions[ev.key];
    if (dir && e.vb) {
      ev.preventDefault();
      if (!e.actif) {
        const depart = e.traits.length ? { x: e.vb.w * 0.2, y: e.vb.h * 0.75 } : { x: e.vb.w * 0.15, y: e.vb.h * 0.55 };
        commencer(depart);
      }
      const dernier = e.points[e.points.length - 1];
      prolonger({
        x: Math.min(e.vb.w - 4, Math.max(4, dernier.x + dir.x)),
        y: Math.min(e.vb.h - 4, Math.max(4, dernier.y + dir.y)),
      });
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      terminer();
    }
  };

  return (
    <div className="grid gap-2">
      <div className="relative rounded-[14px] border-[1.5px] border-dashed border-filet-fort bg-white">
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label="Zone de signature"
          aria-describedby={description}
          className="block h-[220px] w-full cursor-crosshair touch-none rounded-[14px] min-[760px]:h-[250px]"
          onPointerDown={(ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            commencer(position(ev));
          }}
          onPointerMove={(ev) => {
            if (!etat.current.actif) return;
            const evenements = ev.nativeEvent.getCoalescedEvents?.() ?? [];
            if (evenements.length) {
              const r = ev.currentTarget.getBoundingClientRect();
              const k = echelle();
              evenements.forEach((n) => prolonger({ x: (n.clientX - r.left) / k, y: (n.clientY - r.top) / k }));
            } else {
              prolonger(position(ev));
            }
          }}
          onPointerUp={terminer}
          onPointerCancel={terminer}
          onBlur={terminer}
          onKeyDown={clavier}
        />
        {vide ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[46px] text-center text-[#B9B2A3]">
            Signez ici
          </div>
        ) : null}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[18px] bottom-[38px] border-t border-[#E3DCCD]" />
      </div>
      <p id={description} className="sr-only">
        Tracez votre signature dans ce cadre. Au clavier : les flèches tracent, Entrée lève le stylo.
      </p>
      <p aria-live="polite" className="sr-only">
        {vide ? "Le cadre de signature est vide." : "Signature tracée."}
      </p>
      <div>
        <button
          type="button"
          onClick={effacer}
          className="inline-flex min-h-11 items-center gap-2 rounded-controle px-3 text-[14px] font-medium text-encre hover:bg-[rgba(20,33,43,0.06)] [&_svg]:size-[18px]"
        >
          <Eraser aria-hidden="true" strokeWidth={1.75} />
          Effacer
        </button>
      </div>
    </div>
  );
}
