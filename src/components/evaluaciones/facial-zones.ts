/**
 * Anatomical zones overlaid on the facial photo (face-base.jpg, 1000x1000).
 *
 * Each zone is a polygon expressed in the same SVG viewBox coords as the
 * photo (0–1000 x 0–1000). The label `point` is the anchor where the
 * connector line touches the face — usually a key visual landmark for that
 * zone. The label `box` is where the floating label sits relative to the
 * photo's bounding rect (-1..2 ratio so labels can sit outside the photo).
 *
 * These coordinates were calibrated to face-base.jpg specifically. If the
 * photo changes, recalibrate.
 */

export const FACE_VIEWBOX = 1000;

export interface FacialZoneDef {
  id: string;
  label: string;
  /** SVG path d for the zone polygon (viewBox 0–1000). */
  path: string;
  /** Single-point anchor where the connector line touches the face. */
  anchor: { x: number; y: number };
  /** Where the label sits relative to the SVG world (0..100 percent of
   * viewBox width/height). Side picks which side of the photo it floats on. */
  placement: {
    x: number;
    y: number;
    side: "left" | "right";
  };
}

export const FACIAL_ZONES: FacialZoneDef[] = [
  {
    id: "frente",
    label: "Frente",
    path: "M 360 200 Q 500 140 640 200 L 640 280 Q 500 230 360 280 Z",
    anchor: { x: 500, y: 240 },
    placement: { x: 78, y: 14, side: "right" },
  },
  {
    id: "sien-derecha",
    label: "Sien",
    path: "M 290 250 L 360 230 L 360 360 L 300 380 Z",
    anchor: { x: 320, y: 305 },
    placement: { x: 4, y: 22, side: "left" },
  },
  {
    id: "ojeras",
    label: "Ojeras",
    path: "M 360 410 Q 440 430 440 460 L 440 495 Q 400 505 360 495 Z M 560 410 Q 560 430 640 410 L 640 495 Q 600 505 560 495 Z",
    anchor: { x: 380, y: 470 },
    placement: { x: 4, y: 35, side: "left" },
  },
  {
    id: "nariz",
    label: "Nariz",
    path: "M 470 380 Q 500 370 530 380 L 545 540 Q 530 575 500 580 Q 470 575 455 540 Z",
    anchor: { x: 515, y: 480 },
    placement: { x: 78, y: 38, side: "right" },
  },
  {
    id: "pomulos",
    label: "Pómulos",
    path: "M 290 460 Q 350 470 380 510 L 360 580 Q 320 580 280 540 Z M 620 510 Q 650 470 710 460 L 720 540 Q 680 580 640 580 Z",
    anchor: { x: 670, y: 530 },
    placement: { x: 78, y: 50, side: "right" },
  },
  {
    id: "surco-nasolabial",
    label: "Surco nasolabial",
    path: "M 380 580 Q 430 600 460 620 L 450 660 Q 420 660 390 640 Z M 540 620 Q 570 600 620 580 L 610 640 Q 580 660 550 660 Z",
    anchor: { x: 410, y: 625 },
    placement: { x: 4, y: 52, side: "left" },
  },
  {
    id: "labios",
    label: "Labios",
    path: "M 410 645 Q 500 625 590 645 Q 570 695 500 705 Q 430 695 410 645 Z",
    anchor: { x: 410, y: 680 },
    placement: { x: 4, y: 67, side: "left" },
  },
  {
    id: "mandibula-derecha",
    label: "Mandíbula",
    path: "M 280 600 Q 320 660 380 700 L 380 760 Q 320 740 270 690 Z M 620 700 Q 680 660 720 600 L 730 690 Q 680 740 620 760 Z",
    anchor: { x: 700, y: 700 },
    placement: { x: 78, y: 68, side: "right" },
  },
  {
    id: "menton",
    label: "Mentón",
    path: "M 410 740 Q 500 770 590 740 L 580 820 Q 500 840 420 820 Z",
    anchor: { x: 500, y: 800 },
    placement: { x: 78, y: 80, side: "right" },
  },
];
