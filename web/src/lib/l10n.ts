// 언어가 바뀌면 guide·실험·센서 내용을 그 언어로 바꿔 둡니다 (원본 한국어는 따로 보관).
// 찾기에 쓰는 값(level·course·area·category)은 바꾸지 않고, 화면에 보일 때 c('level.…')로 번역합니다.
import { c } from './i18n';
import { boards, breadboard, commonRules, connectors, parts, planned, troubles } from './guide';
import { experiments } from './experiments';
import { analogTypes, digitalTypes } from './sensors';
import { relocalizeDevice } from './device';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const base = {
  common: clone(commonRules), planned: clone(planned), boards: clone(boards), connectors: clone(connectors),
  parts: clone(parts), troubles: clone(troubles), breadboard: clone(breadboard), experiments: clone(experiments),
  sensors: clone([...analogTypes, ...digitalTypes]),
};

const list = (key: string, arr: string[] | undefined) => (arr ?? []).map((s, i) => c(`${key}.${i}`, s));

export function relocalize() {
  relocalizeDevice();
  base.common.forEach((s, i) => { commonRules[i] = c(`guide.common.${i}`, s); });
  base.planned.forEach((s, i) => { planned[i] = c(`guide.planned.${i}`, s); });

  base.boards.forEach((b, i) => {
    const k = `board.${b.id}`, o = boards[i];
    o.name = c(`${k}.name`, b.name); o.firmwareNote = c(`${k}.firmwareNote`, b.firmwareNote);
    o.usb = c(`${k}.usb`, b.usb); o.logic = c(`${k}.logic`, b.logic); o.adc = c(`${k}.adc`, b.adc); o.qwiic = c(`${k}.qwiic`, b.qwiic);
    o.notes = list(`${k}.notes`, b.notes);
  });
  for (const [id, b] of Object.entries(base.connectors)) {
    const k = `conn.${id}`, o = connectors[id];
    o.name = c(`${k}.name`, b.name);
    b.wires.forEach((w, i) => { o.wires[i].term = c(`${k}.wires.${i}`, w.term); });
    o.steps = list(`${k}.steps`, b.steps); o.cautions = list(`${k}.cautions`, b.cautions);
    if (b.breadboard && o.breadboard) o.breadboard.why = c(`${k}.bb`, b.breadboard.why);
    if (b.resistor && o.resistor) o.resistor.value = c(`${k}.res`, b.resistor.value);
  }
  base.parts.forEach((p, i) => {
    const k = `part.${p.id}`, o = parts[i];
    o.name = c(`${k}.name`, p.name); o.items = list(`${k}.items`, p.items); o.cautions = list(`${k}.cautions`, p.cautions);
  });
  base.troubles.forEach((tr, i) => {
    const k = `trouble.${tr.id}`, o = troubles[i];
    o.title = c(`${k}.title`, tr.title); o.steps = list(`${k}.steps`, tr.steps);
  });
  const bb = base.breadboard;
  breadboard.intro = c('bb.intro', bb.intro);
  breadboard.structure = list('bb.structure', bb.structure);
  breadboard.rules = list('bb.rules', bb.rules);
  bb.resistors.forEach((r, i) => {
    breadboard.resistors[i].bands = c(`bb.res.${r.value}.bands`, r.bands);
    breadboard.resistors[i].use = c(`bb.res.${r.value}.use`, r.use);
  });
  bb.circuits.forEach((x, i) => {
    const k = `bb.circuit.${x.id}`, o = breadboard.circuits[i];
    o.name = c(`${k}.name`, x.name); o.what = c(`${k}.what`, x.what); o.steps = list(`${k}.steps`, x.steps);
    if (x.caution) o.caution = c(`${k}.caution`, x.caution);
    x.parts.forEach((pt, j) => { o.parts[j].label = c(`${k}.part.${j}`, pt.label); });
  });

  base.sensors.forEach((s) => {
    const o = [...analogTypes, ...digitalTypes].find((x) => x.type === s.type);
    if (!o) return;
    const k = `sensor.${s.type}`;
    o.name = c(`${k}.name`, s.name); o.note = c(`${k}.note`, s.note);
    if (s.cal?.hint && o.cal) o.cal.hint = c(`${k}.cal.hint`, s.cal.hint);
  });

  base.experiments.forEach((e) => {
    const o = experiments.find((x) => x.id === e.id);
    if (!o) return;
    const k = `exp.${e.id}`;
    o.title = c(`${k}.title`, e.title); o.subject = c(`${k}.subject`, e.subject);
    if (e.summary) o.summary = c(`${k}.summary`, e.summary);
    o.x = { ...o.x, label: c(`${k}.x`, e.x.label) };
    o.y = e.y.map((y, i) => ({ ...o.y[i], label: c(`${k}.y.${i}`, y.label) }));
    if (e.event && o.event) o.event = { ...o.event, label: c(`${k}.event`, e.event.label), unit: c(`${k}.event.unit`, e.event.unit) };
    o.markers = { ...o.markers, label: c(`${k}.markers.label`, e.markers.label), prompt: c(`${k}.markers.prompt`, e.markers.prompt) };
    o.steps = list(`${k}.steps`, e.steps);
    if (e.standardTexts) o.standardTexts = list(`${k}.std`, e.standardTexts);
    if (e.setup && o.setup) {
      o.setup = { ...o.setup, materials: list(`${k}.materials`, e.setup.materials), attach: list(`${k}.attach`, e.setup.attach), cautions: list(`${k}.cautions`, e.setup.cautions) };
    }
    if (e.breadboard && o.breadboard) o.breadboard = { ...o.breadboard, why: c(`${k}.bb`, e.breadboard.why) };
  });
}

/** 찾기 값의 표시 이름 */
export const levelName = (v?: string) => (v ? c(`level.${v}`, v) : '');
export const courseName = (v?: string) => (v ? c(`course.${v}`, v) : '');
export const areaName = (v?: string) => (v ? c(`area.${v}`, v) : '');
export const catName = (v: string) => c(`cat.${v}`, v);
