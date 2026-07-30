// ============================================================
// PAUSE MENU — paints the run ledger onto the #resume overlay
// ============================================================
// Pure presentation: it receives the view model built by
// ui/_partials/pauseModel.js and writes it into the static skeleton declared in
// index.html. No gameplay rule, no Game reference, no state of its own beyond
// the pooled rows it reuses so repeated pauses never churn DOM nodes.

import { PauseCollection } from './_partials/PauseCollection.js';

const STATUS_MARK = { done: '✓', active: '◆', todo: '○' };

export class PauseMenu {
  constructor(doc = document) {
    this.doc = doc;
    this.location = doc.getElementById('pause-location');
    this.objectives = doc.getElementById('pause-objectives');
    this.memoriesCount = doc.getElementById('pause-memories-count');
    this.memoriesFill = doc.getElementById('pause-memories-fill');
    this.memoriesMeter = doc.getElementById('pause-memories');
    this.zoneRows = doc.getElementById('pause-zone-rows');
    this.soulPips = doc.getElementById('pause-soul-pips');
    this.soulCount = doc.getElementById('pause-soul-count');
    this.zonePips = doc.getElementById('pause-zone-pips');
    this.zoneCount = doc.getElementById('pause-zone-count');
    this.vitals = doc.getElementById('pause-vitals');
    this.controls = doc.getElementById('pause-controls');
    this.run = doc.getElementById('pause-run');

    // Row pools, keyed by container. Rows are built once and reused, so a pause
    // after twenty others costs no allocation.
    this._pools = new Map();
    this._pool = (container, count, create, attach) =>
      this._rows(container, count, create, attach);
    this.collection = new PauseCollection(doc, this._pool);
    this._tabs = this._wireTabs();

    // The overlay resumes when its BACKDROP is clicked (GamePause listens on
    // #resume). The panel is now browsable, so it swallows clicks instead — the
    // Resume button is bound directly by GamePause, so it still works.
    this.shell = doc.querySelector?.('#resume .pause-shell');
    this.shell?.addEventListener('click', (event) => event.stopPropagation());
  }

  render(model) {
    if (!this.location) return;   // overlay markup absent (e.g. a unit-test DOM)
    this.location.textContent = model.location;
    this._renderObjectives(model.objectives);
    this._renderMemories(model.memories);
    this._renderPips(this.soulPips, model.souls.found, model.souls.total, 'soul');
    this.soulCount.textContent = model.souls.label;
    this._renderPips(this.zonePips, model.zonesRestored.found, model.zonesRestored.total, 'zone');
    this.zoneCount.textContent = model.zonesRestored.label;
    this._renderVitals(model.vitals);
    this._renderControls(model.controls);
    this._renderRun(model.run);
    this.collection.renderCollection(model.collection || []);
    this.collection.renderLore(model.lore || []);
    // Every pause opens on the ledger: the player paused to check something, not
    // to resume where they left off browsing.
    this._showTab('ledger');
  }

  // ---- sections ------------------------------------------------------------

  _renderObjectives(objectives) {
    const rows = this._rows(this.objectives, objectives.length, () => {
      const row = this.doc.createElement('li');
      row.className = 'pause-objective';
      const mark = this.doc.createElement('span');
      mark.className = 'pause-objective-mark';
      mark.setAttribute('aria-hidden', 'true');
      const body = this.doc.createElement('span');
      body.className = 'pause-objective-body';
      const label = this.doc.createElement('span');
      label.className = 'pause-objective-label';
      const detail = this.doc.createElement('span');
      detail.className = 'pause-objective-detail';
      body.append(label, detail);
      row.append(mark, body);
      row._label = label;
      row._detail = detail;
      row._mark = mark;
      return row;
    });

    objectives.forEach((objective, index) => {
      const row = rows[index];
      row.className = `pause-objective is-${objective.status}`;
      row._mark.textContent = STATUS_MARK[objective.status] || STATUS_MARK.todo;
      row._label.textContent = objective.label;
      row._detail.textContent = objective.detail || '';
      // Screen readers get the state in words; the glyph is decorative.
      row.setAttribute('data-status', objective.status);
    });
  }

  _renderMemories(memories) {
    this.memoriesCount.textContent = memories.label;
    this._setMeter(this.memoriesFill, memories.found, memories.total, this.memoriesMeter);

    const rows = this._rows(this.zoneRows, memories.zones.length, () => {
      const row = this.doc.createElement('li');
      row.className = 'pause-zone-row';
      const label = this.doc.createElement('span');
      label.className = 'pause-zone-label';
      const track = this.doc.createElement('span');
      track.className = 'pause-mini-track';
      const fill = this.doc.createElement('span');
      fill.className = 'pause-mini-fill';
      track.append(fill);
      const count = this.doc.createElement('strong');
      count.className = 'pause-zone-count';
      row.append(label, track, count);
      row._label = label;
      row._track = track;
      row._fill = fill;
      row._count = count;
      return row;
    });

    memories.zones.forEach((zone, index) => {
      const row = rows[index];
      row.className = 'pause-zone-row'
        + (zone.complete ? ' is-complete' : '')
        + (zone.locked ? ' is-locked' : '');
      row._label.textContent = zone.label;
      row._count.textContent = zone.locked && zone.found === 0 ? 'Sealed' : zone.countLabel;
      this._setMeter(row._fill, zone.found, zone.total);
    });
  }

  // One diamond per Guardian Soul, one dot per zone — a glanceable count that
  // does not need reading. The numeric label beside it carries the same value
  // for assistive tech, so the pips themselves are aria-hidden in the markup.
  _renderPips(container, filled, total, kind) {
    const pips = this._rows(container, total, () => {
      const pip = this.doc.createElement('span');
      pip.className = 'pause-pip';
      return pip;
    });
    pips.forEach((pip, index) => {
      pip.className = `pause-pip is-${kind}` + (index < filled ? ' is-filled' : '');
    });
  }

  _renderVitals(vitals) {
    const rows = this._rows(this.vitals, vitals.length, () => {
      const row = this.doc.createElement('div');
      row.className = 'pause-vital';
      const label = this.doc.createElement('span');
      label.className = 'pause-vital-label';
      const track = this.doc.createElement('span');
      track.className = 'pause-mini-track';
      const fill = this.doc.createElement('span');
      fill.className = 'pause-mini-fill';
      track.append(fill);
      const count = this.doc.createElement('strong');
      count.className = 'pause-vital-count';
      row.append(label, track, count);
      row._label = label;
      row._track = track;
      row._fill = fill;
      row._count = count;
      return row;
    });

    vitals.forEach((vital, index) => {
      const row = rows[index];
      row.className = `pause-vital is-${vital.id}`;
      row._label.textContent = vital.label;
      row._count.textContent = vital.countLabel;
      this._setMeter(row._fill, vital.value, vital.max);
    });
  }

  _renderControls(groups) {
    const columns = this._rows(this.controls, groups.length, () => {
      const column = this.doc.createElement('div');
      column.className = 'pause-control-group';
      const title = this.doc.createElement('div');
      title.className = 'pause-control-title';
      // Says why a group's rows are dimmed (e.g. combat outside an arena).
      const note = this.doc.createElement('div');
      note.className = 'pause-control-note';
      const list = this.doc.createElement('dl');
      list.className = 'pause-control-list';
      column.append(title, note, list);
      column._title = title;
      column._note = note;
      column._list = list;
      return column;
    });

    groups.forEach((group, index) => {
      const column = columns[index];
      column._title.textContent = group.group;
      column._note.textContent = group.note || '';
      const rows = this._rows(column._list, group.items.length, () => {
        const keys = this.doc.createElement('dt');
        keys.className = 'pause-keys';
        const action = this.doc.createElement('dd');
        action.className = 'pause-action';
        // A <dl> child pair cannot live in a wrapper element without breaking
        // the definition-list semantics, so the pool row owns both siblings.
        keys._sibling = action;
        return keys;
      }, (list, row) => list.append(row, row._sibling));

      group.items.forEach((item, itemIndex) => {
        const keys = rows[itemIndex];
        keys.textContent = '';
        for (const key of item.keys) {
          const chip = this.doc.createElement('kbd');
          chip.textContent = key;
          keys.append(chip);
        }
        keys._sibling.textContent = item.action;
        // A binding that exists but is not live here stays listed, dimmed.
        const state = item.available ? '' : ' is-unavailable';
        keys.className = `pause-keys${state}`;
        keys._sibling.className = `pause-action${state}`;
      });
    });
  }

  _renderRun(stats = []) {
    const rows = this._rows(this.run, stats.length, () => {
      const row = this.doc.createElement('div');
      row.className = 'pause-run-stat';
      const value = this.doc.createElement('strong');
      value.className = 'pause-run-value';
      const label = this.doc.createElement('span');
      label.className = 'pause-run-label';
      row.append(value, label);
      row._value = value;
      row._label = label;
      return row;
    });
    stats.forEach((stat, index) => {
      rows[index].className = `pause-run-stat is-${stat.id}`;
      rows[index]._value.textContent = stat.value;
      rows[index]._label.textContent = stat.label;
    });
  }

  // ---- tabs ----------------------------------------------------------------

  // Three panels behind one strip. The tab buttons stop propagation because the
  // overlay's backdrop resumes on click — browsing must never eject the player
  // back into the water.
  _wireTabs() {
    const tabs = [];
    for (const name of ['ledger', 'memories', 'lore']) {
      const button = this.doc.getElementById(`pause-tab-${name}`);
      const panel = this.doc.getElementById(`pause-panel-${name}`);
      if (!button || !panel) continue;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this._showTab(name);
      });
      tabs.push({ name, button, panel });
    }
    return tabs;
  }

  _showTab(name) {
    for (const tab of this._tabs) {
      const active = tab.name === name;
      tab.button.classList.toggle('active', active);
      tab.button.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.panel.classList.toggle('active', active);
      tab.panel.hidden = !active;
    }
    if (name !== 'memories') this.collection.closeDetail();
  }

  // ---- primitives ----------------------------------------------------------

  // `meter` is the element carrying role="progressbar" and is only passed for the
  // one bar that has it — aria-value* on a plain decorative track would be a lie
  // to assistive tech, which reads the adjacent count text instead.
  _setMeter(fill, current, total, meter = null) {
    const clamped = total > 0 ? Math.max(0, Math.min(current, total)) : 0;
    fill.style.width = total > 0 ? `${(clamped / total) * 100}%` : '0%';
    if (!meter) return;
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', String(total));
    meter.setAttribute('aria-valuenow', String(clamped));
  }

  // Grow a container's pooled rows to `count`, hide the surplus, and return the
  // visible ones. `attach` covers containers whose row is more than one node.
  _rows(container, count, create, attach = (parent, row) => parent.append(row)) {
    if (!container) return [];
    let pool = this._pools.get(container);
    if (!pool) {
      pool = [];
      this._pools.set(container, pool);
    }
    while (pool.length < count) {
      const row = create();
      attach(container, row);
      pool.push(row);
    }
    for (let i = 0; i < pool.length; i++) {
      const hidden = i >= count;
      pool[i].hidden = hidden;
      if (pool[i]._sibling) pool[i]._sibling.hidden = hidden;
    }
    return pool.slice(0, count);
  }
}
