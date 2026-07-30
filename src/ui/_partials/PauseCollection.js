// ============================================================
// PAUSE COLLECTION — the Memories grid + its detail view, and the Lore panel
// ============================================================
// Split out of PauseMenu.js so each file stays one screenful of one concern.
// Same contract as its parent: it receives view-model data, owns no gameplay
// rule, and pools its rows so reopening the pause menu allocates nothing.
//
// A found memory can be re-read here without walking back to its pedestal. The
// text is shown INSIDE the pause overlay rather than by reusing DiscoveryScreen:
// that screen's promise resolves on an active-time wait, which is frozen while
// paused, so borrowing it would deadlock the panel it was opened from.

export class PauseCollection {
  constructor(doc, pool) {
    this.doc = doc;
    // `pool(container, count, create, attach?)` is PauseMenu's row pooler.
    this.pool = pool;
    this.grid = doc.getElementById('pause-memory-groups');
    this.detail = doc.getElementById('pause-memory-detail');
    this.detailImage = doc.getElementById('pause-detail-image');
    this.detailFil = doc.getElementById('pause-detail-fil');
    this.detailEng = doc.getElementById('pause-detail-eng');
    this.detailOrigin = doc.getElementById('pause-detail-origin');
    this.detailLore = doc.getElementById('pause-detail-lore');
    this.detailBack = doc.getElementById('pause-detail-back');
    this.loreGroups = doc.getElementById('pause-lore');

    this.detailBack?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.closeDetail();
    });
  }

  // ---- Memories grid -------------------------------------------------------

  renderCollection(groups) {
    if (!this.grid) return;
    this.closeDetail();
    const sections = this.pool(this.grid, groups.length, () => {
      const section = this.doc.createElement('section');
      section.className = 'pause-memory-group';
      const head = this.doc.createElement('div');
      head.className = 'pause-memory-head';
      const label = this.doc.createElement('span');
      label.className = 'pause-memory-zone';
      const count = this.doc.createElement('strong');
      count.className = 'pause-memory-count';
      head.append(label, count);
      const slots = this.doc.createElement('div');
      slots.className = 'pause-memory-slots';
      section.append(head, slots);
      section._label = label;
      section._count = count;
      section._slots = slots;
      return section;
    });

    groups.forEach((group, index) => {
      const section = sections[index];
      section._label.textContent = group.label;
      section._count.textContent = group.countLabel;
      const slots = this.pool(section._slots, group.items.length, () => {
        const slot = this.doc.createElement('button');
        slot.className = 'pause-slot';
        slot.type = 'button';
        const art = this.doc.createElement('img');
        art.className = 'pause-slot-art';
        art.alt = '';
        art.loading = 'lazy';
        const name = this.doc.createElement('span');
        name.className = 'pause-slot-name';
        slot.append(art, name);
        slot._art = art;
        slot._name = name;
        // One listener per pooled slot, reading whatever item it currently holds.
        slot.addEventListener('click', (event) => {
          event.stopPropagation();       // browsing must never resume the game
          if (slot._item?.found) this.openDetail(slot._item);
        });
        return slot;
      });

      group.items.forEach((item, itemIndex) => {
        const slot = slots[itemIndex];
        slot._item = item;
        slot.className = `pause-slot ${item.found ? 'is-found' : 'is-empty'}`;
        slot.disabled = !item.found;
        if (item.found) {
          if (slot._art.getAttribute?.('src') !== item.image) slot._art.src = item.image;
          slot._art.alt = item.eng;
          slot._name.textContent = item.fil;
          slot.setAttribute('aria-label', `${item.fil} — ${item.eng}. Read this memory.`);
          slot.setAttribute('title', item.eng);
        } else {
          slot._art.removeAttribute?.('src');
          slot._art.alt = '';
          slot._name.textContent = 'Not yet found';
          slot.setAttribute('aria-label', 'A memory still lost beneath the water');
          slot.setAttribute('title', 'Still drowned');
        }
      });
    });
  }

  openDetail(item) {
    if (!this.detail) return;
    this.detailImage.src = item.image;
    this.detailImage.alt = item.eng;
    this.detailFil.textContent = item.fil;
    this.detailEng.textContent = item.eng;
    this.detailOrigin.textContent = item.origin;
    this.detailLore.textContent = item.lore;
    this.detail.classList.add('active');
    this.grid.classList.add('is-behind');
    this.detailBack?.focus?.();
  }

  closeDetail() {
    if (!this.detail) return;
    this.detail.classList.remove('active');
    this.grid?.classList.remove('is-behind');
  }

  // ---- Lore panel ----------------------------------------------------------

  renderLore(entries) {
    if (!this.loreGroups) return;
    const cards = this.pool(this.loreGroups, entries.length, () => {
      const card = this.doc.createElement('article');
      card.className = 'pause-lore-card';
      const name = this.doc.createElement('h4');
      name.className = 'pause-lore-name';
      const subtitle = this.doc.createElement('div');
      subtitle.className = 'pause-lore-subtitle';
      const body = this.doc.createElement('p');
      body.className = 'pause-lore-body';
      const meta = this.doc.createElement('dl');
      meta.className = 'pause-lore-meta';
      const line = this.doc.createElement('div');
      line.className = 'pause-lore-line';
      const lineFil = this.doc.createElement('span');
      lineFil.className = 'pause-lore-fil';
      const lineEng = this.doc.createElement('span');
      lineEng.className = 'pause-lore-eng';
      line.append(lineFil, lineEng);
      card.append(name, subtitle, body, meta, line);
      card._name = name;
      card._subtitle = subtitle;
      card._body = body;
      card._meta = meta;
      card._fil = lineFil;
      card._eng = lineEng;
      return card;
    });

    entries.forEach((entry, index) => {
      const card = cards[index];
      card.className = `pause-lore-card${entry.restored ? ' is-restored' : ''}`;
      // A briefing card has nothing to restore, so it carries no count.
      card._name.textContent = entry.countLabel
        ? `${entry.name} — ${entry.countLabel}`
        : entry.name;
      card._subtitle.textContent = entry.subtitle;
      card._body.textContent = entry.body;
      card._fil.textContent = entry.line;
      card._eng.textContent = entry.lineEn;
      this._renderMeta(card._meta, [
        ['Guardian', entry.guardian],
        ['Trial', entry.trial],
      ]);
    });
  }

  _renderMeta(list, pairs) {
    const rows = this.pool(list, pairs.length, () => {
      const term = this.doc.createElement('dt');
      const description = this.doc.createElement('dd');
      term._sibling = description;
      return term;
    }, (parent, row) => parent.append(row, row._sibling));
    pairs.forEach(([term, value], index) => {
      rows[index].textContent = term;
      rows[index]._sibling.textContent = value;
    });
  }
}
