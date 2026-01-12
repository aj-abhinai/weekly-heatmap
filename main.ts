import { Plugin, WorkspaceLeaf, ItemView, TFile, Notice, PluginSettingTab, App, Setting } from 'obsidian';

const VIEW_TYPE_WEEKLY_HEATMAP = 'weekly-heatmap-view';

// Settings interface
interface WeeklyHeatmapSettings {
  folderPath: string;
  noteTemplate: string;
  weekStartDay: number; // 0 = Sunday, 1 = Monday
}

const DEFAULT_SETTINGS: WeeklyHeatmapSettings = {
  folderPath: 'Weekly Notes',
  noteTemplate: '## Tasks\n\n- [ ] \n\n## Notes\n\n',
  weekStartDay: 1, // Monday
};

export default class WeeklyHeatmapPlugin extends Plugin {
  settings: WeeklyHeatmapSettings;

  async onload() {
    await this.loadSettings();

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

    // Add settings tab
    this.addSettingTab(new WeeklyHeatmapSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh the view when settings change
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEEKLY_HEATMAP);
    leaves.forEach(leaf => {
      if (leaf.view instanceof WeeklyHeatmapView) {
        leaf.view.render();
      }
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

  onunload() { }
}

// Settings Tab
class WeeklyHeatmapSettingTab extends PluginSettingTab {
  plugin: WeeklyHeatmapPlugin;

  constructor(app: App, plugin: WeeklyHeatmapPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Weekly Heatmap Settings' });

    // Folder Path Setting
    new Setting(containerEl)
      .setName('Weekly Notes Folder')
      .setDesc('The folder where weekly notes will be created')
      .addText(text => text
        .setPlaceholder('Weekly Notes')
        .setValue(this.plugin.settings.folderPath)
        .onChange(async (value) => {
          this.plugin.settings.folderPath = value || 'Weekly Notes';
          await this.plugin.saveSettings();
        }));

    // Week Start Day Setting
    new Setting(containerEl)
      .setName('Week Start Day')
      .setDesc('Choose which day your week starts on')
      .addDropdown(dropdown => dropdown
        .addOption('1', 'Monday')
        .addOption('0', 'Sunday')
        .setValue(String(this.plugin.settings.weekStartDay))
        .onChange(async (value) => {
          this.plugin.settings.weekStartDay = parseInt(value);
          await this.plugin.saveSettings();
        }));

    // Note Template Setting
    new Setting(containerEl)
      .setName('Note Template')
      .setDesc('Template for new weekly notes. Use markdown formatting.')
      .addTextArea(text => {
        text
          .setPlaceholder('## Tasks\n\n- [ ] \n\n## Notes\n\n')
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.noteTemplate = value || DEFAULT_SETTINGS.noteTemplate;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 8;
        text.inputEl.cols = 40;
      });
  }
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
  async onClose() { }

  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  getWeekStart(year: number, week: number): Date {
    const jan1 = new Date(year, 0, 1);
    const days = (week - 1) * 7;
    const dayOfWeek = jan1.getDay();
    const startDay = this.plugin.settings.weekStartDay;

    let diff: number;
    if (startDay === 1) { // Monday
      diff = dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek;
    } else { // Sunday
      diff = -dayOfWeek;
    }

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

      const weekStart = this.getWeekStart(currentYear, week);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      if (week < currentWeek) {
        weekCell.addClass('week-past');
      } else if (week === currentWeek) {
        weekCell.addClass('week-current');
      } else {
        weekCell.addClass('week-future');
      }

      // Show week info on hover using title attribute (native browser tooltip)
      weekCell.setAttribute('title', `Week ${week}: ${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`);

      weekCell.addEventListener('click', () => {
        if (week > currentWeek + 1) {
          new Notice('✨ Focus on the present week first!', 2000);
          return;
        }
        this.openWeeklyNote(week, weekStart, weekEnd, currentYear);
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

  async openWeeklyNote(weekNum: number, weekStart: Date, weekEnd: Date, year: number) {
    const folderPath = this.plugin.settings.folderPath;
    const fileName = `Week ${weekNum} - ${this.formatDate(weekStart)} to ${this.formatDate(weekEnd)}, ${year}`;
    const filePath = `${folderPath}/${fileName}.md`;

    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }

    let file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file) {
      const content = this.plugin.settings.noteTemplate;
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
