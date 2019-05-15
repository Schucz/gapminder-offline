import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { ALERT, SEND_TAB_TO_BOOKMARK } from '../../constants';
import { MessageService } from '../../message.service';
import { Subscription } from 'rxjs';
import { ElectronService } from '../../providers/electron.service';

@Component({
  selector: 'app-bookmark-form',
  templateUrl: './bookmark-form.component.html',
  styleUrls: ['./bookmark-form.component.css']
})
export class BookmarkFormComponent implements OnDestroy {
  @Output() onPopoverClose = new EventEmitter();
  subscription: Subscription;
  bookmark;
  bookmarkFolders;
  waitForId = false;
  isBookmarkConstructed = false;
  private globConst;

  constructor(private ms: MessageService, private es: ElectronService) {
    this.globConst = this.es.remote.getGlobal('globConst');
    this.initBookmark();
    this.subscription = this.ms.getMessage().subscribe((event: any) => {
      if (event.message === SEND_TAB_TO_BOOKMARK) {
        this.initBookmark();
        this.isBookmarkConstructed = false;
        this.bookmark.content.model = event.options.model;
        this.bookmark.content.chartType = event.options.chartType;
        this.bookmark.name = event.options.name;
        this.es.ipcRenderer.send(this.globConst.GET_BOOKMARKS);
        this.waitForId = true;
      }
    });

    this.es.ipcRenderer.on(this.globConst.GOT_BOOKMARKS, (event, result) => {
      if (!this.waitForId) {
        return;
      }

      if (result.error) {
        console.log(result.error);
        this.ms.sendMessage(ALERT, {message: result.error, type: 'danger'});
        return;
      }

      this.bookmarkFolders = result.data.folders;
      this.waitForId = false;
      this.bookmark.id = this.getNextBookmarkId(result.data.content);
      this.bookmark.date = new Date().toISOString();
      const crowBar = document.getElementById('svg-crowbar');

      if (crowBar) {
        crowBar.remove();
      }

      const scriptEl = document.createElement('script');

      scriptEl.setAttribute('src', './lib/svg-crowbar.js');
      scriptEl.setAttribute('id', 'svg-crowbar');
      scriptEl.setAttribute('class', 'svg-crowbar');
      scriptEl.setAttribute('transform', 'export');
      scriptEl.setAttribute('data-svg-select', 'div[class="tab-pane"][style*="display: block"] div>svg.vzb-export');
      scriptEl.setAttribute('data-exclude-element-select', '.vzb-noexport');
      document.body.appendChild(scriptEl);

      const int = setInterval(() => {
        if (!!(window as any).__tmpImage) {
          this.es.ipcRenderer.send(this.globConst.ADD_BOOKMARK, {bookmark: this.bookmark, image: (window as any).__tmpImage});
          this.ms.lock();
          (window as any).__tmpImage = null;
          clearInterval(int);
          this.isBookmarkConstructed = true;
        }
      }, 500);
    });

    this.es.ipcRenderer.on(this.globConst.BOOKMARK_UPDATED, () => {
      this.onPopoverClose.emit();
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  remove() {
    this.es.ipcRenderer.send(this.globConst.REMOVE_BOOKMARK, {bookmark: this.bookmark});
    this.onPopoverClose.emit();
    this.ms.lock();
  }

  done() {
    this.bookmark.date = new Date().toISOString();
    this.es.ipcRenderer.send(this.globConst.UPDATE_BOOKMARK, {bookmark: this.bookmark});
    this.isBookmarkConstructed = false;
    this.onPopoverClose.emit();
    this.ms.lock();
  }

  onFolderChange(event: any) {
    this.bookmark.folder = event.target.value;
  }

  isLocked(): boolean {
    return this.ms.isLocked();
  }

  private getNextBookmarkId(bookmarks): number {
    let result = 0;

    for (const bookmark of bookmarks) {
      if (bookmark.id > result) {
        result = bookmark.id;
      }
    }

    return ++result;
  }

  private initBookmark() {
    this.bookmark = {
      id: 0,
      name: '',
      date: '',
      folder: '',
      content: {
        chartType: '',
        model: null
      }
    };
  }
}