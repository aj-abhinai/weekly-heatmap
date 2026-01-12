import { Plugin, WorkspaceLeaf, ItemView, TFile, Notice } from 'obsidian';

const VIEW_TYPE_WEEKLY_HEATMAP = 'weekly-heatmap-view';

export default class WeeklyHeatmapPlugin extends Plugin {
  async onload() {
    this.registerView(
      VIEW_TYPE_WEEKLY_HEATMAP,
      (leaf: WorkspaceLeaf) => new WeeklyHeatmapView(leaf, this)
    );

    this.addRibbonIcon('calendar-glyph', 'Weekly Heatmap', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-weekly-heatmap',
      name: 'Open Weekly Heatmap',
      callback: () => {
        this.activateView();
      },
    });
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_WEEKLY_HEATMAP);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_WEEKLY_HEATMAP, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  onunload() {}
}

class WeeklyHeatmapView extends ItemView {
  plugin: WeeklyHeatmapPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: WeeklyHeatmapPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE_WEEKLY_HEATMAP; }
  getDisplayText() { return 'Weekly Heatmap'; }
  getIcon() { return 'calendar-glyph'; }

  async onOpen() { this.render(); }
  async onClose() {}

  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  getMonday(year: number, week: number): Date {
    const jan1 = new Date(year, 0, 1);
    const days = (week - 1) * 7;
    const dayOfWeek = jan1.getDay();
    const diff = dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek;
    return new Date(year, 0, 1 + diff + days);
  }

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('weekly-heatmap-container');

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentWeek = this.getWeekNumber(today);

    // Header
    const header = container.createDiv({ cls: 'heatmap-header' });
    header.setText(`${currentYear}`);

    const grid = container.createDiv({ cls: 'weekly-heatmap-grid' });

    for (let week = 1; week <= 52; week++) {
      const weekCell = grid.createDiv({ cls: 'week-cell' });

      const monday = this.getMonday(currentYear, week);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      if (week < currentWeek) {
        weekCell.addClass('week-past');
      } else if (week === currentWeek) {
        weekCell.addClass('week-current');
      } else {
        weekCell.addClass('week-future');
      }

      // Show week info on hover using title attribute (native browser tooltip)
      weekCell.setAttribute('title', `Week ${week}: ${this.formatDate(monday)} - ${this.formatDate(sunday)}`);

      weekCell.addEventListener('click', () => {
        if (week > currentWeek + 1) {
          new Notice('✨ Focus on the present week first!', 2000);
          return;
        }
        this.openWeeklyNote(week, monday, sunday, currentYear);
      });
    }

    // Legend
    const legend = container.createDiv({ cls: 'heatmap-legend' });
    legend.innerHTML = `
      <span class="legend-item"><span class="legend-dot past"></span>Past</span>
      <span class="legend-item"><span class="legend-dot current"></span>Current</span>
      <span class="legend-item"><span class="legend-dot future"></span>Upcoming</span>
    `;
  }

  async openWeeklyNote(weekNum: number, monday: Date, sunday: Date, year: number) {
    const folderPath = 'Weekly Notes';
    const fileName = `Week ${weekNum} - ${this.formatDate(monday)} to ${this.formatDate(sunday)}, ${year}`;
    const filePath = `${folderPath}/${fileName}.md`;

    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }

    let file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file) {
      const content = `## Tasks\n\n- [ ] \n\n## Notes\n\n`;
      file = await this.app.vault.create(filePath, content);
    }

    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf();
      if (leaf) {
        await leaf.openFile(file);
      }
    }
  }
}