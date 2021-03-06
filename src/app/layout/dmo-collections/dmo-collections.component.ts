import { RemoveCollectionPopupComponent } from './../../shared/components/remove-collection-popup/remove-collection-popup.component';
import { DmoCollectionsService } from './../../shared/services/dmo-collections.service';
import { CollectionsManagerService } from './../../shared/services/collections-manager.service';
import { DmoCollectionShortDto } from './../models';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { Toastr } from './../../shared/services/toastr.service';

import { concatMap, map, catchError, finalize, takeUntil } from 'rxjs/operators';
import { throwError, Observable, Subject, Subscription } from 'rxjs';

import { Component, OnInit, Input, ViewChild, Output, EventEmitter, OnDestroy, ElementRef } from '@angular/core';
import { FormGroup, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-dmo-collections',
  templateUrl: './dmo-collections.component.html',
  styleUrls: ['./dmo-collections.component.scss']
})
export class DmoCollectionsComponent implements OnInit, OnDestroy {

  addCollectionForm: FormGroup;
  dmoLists: DmoCollectionShortDto[];
  sortedDmoLists: DmoCollectionShortDto[];
  showAddButton = true;
  isFormProcessing = false;
  showSortButton = false;
  sortingTittle: string;
  selectedDmoCollectionName: DmoCollectionShortDto;
  oppenedCollectionId: string;
  private unsubscribe$: Subject<void> = new Subject();
  get collectionName() { return this.addCollectionForm.get('collectionName'); }
  loadCollectionsSubsciption: Subscription;
  rightMenuOpnSubscription: Subscription;
  rightMenuClsSubscription: Subscription;
  @Input() rightMenuIsClosing$: Observable<void>;
  @Input() rightMenuIsOpening$: EventEmitter<void>;
  @Output() closeRightMenu = new EventEmitter<void>();
  @ViewChild('removeCollectionModal', { static: true }) removeModal: NgbActiveModal;
  @ViewChild('collectionNameField', { static: true }) collectionNameField: ElementRef;

  collectionsByDesc = true;
  collectionsByAcs = false;
  collectionsByDefault = false;

  constructor(
    private dmoCollectionsService: DmoCollectionsService,
    private toastr: Toastr,
    private router: Router,
    public matModule: MatDialog,
    private collectionManager: CollectionsManagerService,
    private route: ActivatedRoute) { }


  ngOnInit() {
    this.rightMenuClsSubscription = this.rightMenuIsClosing$.subscribe(() => {
      this.toggleAddCollectionForm(true);
    });
    this.rightMenuOpnSubscription = this.rightMenuIsOpening$.subscribe(() => {
      this.loadCollectionsSubsciption = this.loadCollections();
    })

    this.addCollectionForm = new FormGroup({
      'collectionName': new FormControl('', [Validators.required, Validators.maxLength(20)])
    });

    this.route.params.subscribe(p => {
      if (!p['id']) {
        this.collectionManager.setCollectionId('');
      }
    });

    this.collectionManager.currentCollectionObserver
      .subscribe(col => { this.oppenedCollectionId = col; });

    this.loadCollectionsSubsciption = this.loadCollections();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    this.loadCollectionsSubsciption.unsubscribe();
    this.rightMenuOpnSubscription.unsubscribe();
    this.rightMenuClsSubscription.unsubscribe();
  }

  sortCollections() {
    if (this.collectionsByDesc) {
      this.collectionsByDefault = false;
      this.collectionsByAcs = true;
      this.collectionsByDesc = false;
      this.sortedDmoLists = this.sortedDmoLists.sort(comparer).reverse();
      this.sortingTittle = 'reverce sorting'
    } else if (this.collectionsByAcs) {
      this.collectionsByDefault = true;
      this.collectionsByAcs = false;
      this.collectionsByDesc = false;
      this.sortedDmoLists = this.sortedDmoLists.sort(comparer);
      this.sortingTittle = 'reset sorting'
    } else {
      this.resetCollectionsSort();
    }

    function comparer(a, b) {
      if (a.dmoCount > b.dmoCount) { return 1; }
      if (a.dmoCount < b.dmoCount) { return -1; }

      return 0;
    }
  }

  openCollection(id: string) {
    this.closeRightMenu.emit();
    this.router.navigate(['/dmoCollection', { id: id }]);
  }

  onAddCollection() {
    if (this.addCollectionForm.valid) {
      const collectionName = this.addCollectionForm.get('collectionName').value;
      this.showLoader();

      const add$ = this.dmoCollectionsService.addCollection(collectionName);
      const getAll$ = this.dmoCollectionsService.getCollections();

      const addAndRefresh$ =
        add$.pipe(
          takeUntil(this.unsubscribe$),
          finalize(() => { this.hideLoader(); this.toggleAddCollectionForm(true); }),
          catchError(innerError => { this.hideLoader(); this.resetAddCollectionForm(); return throwError(innerError); }),
          concatMap(() => getAll$.pipe(
            takeUntil(this.unsubscribe$),
            map((response: DmoCollectionShortDto[]) => {
              this.dmoLists = response;
              this.resetCollectionsSort(); }))));

      addAndRefresh$.subscribe({
        error: (err) => { this.toastr.error(err); },
      });
    }
  }

  onDeleteCollection(dmoList: DmoCollectionShortDto) {
    this.selectedDmoCollectionName = dmoList;
    const delteCollectionModal = this.matModule.open(RemoveCollectionPopupComponent, {
      data: dmoList.collectionName
    });

    delteCollectionModal.afterClosed()
      .subscribe({
        next: (shouldDelete: boolean) => {
          if (!shouldDelete) {
            return;
          }

          this.showLoader();
          const delete$ = this.dmoCollectionsService.deleteCollection(this.selectedDmoCollectionName.id);
          const getAll$ = this.dmoCollectionsService.getCollections();

          const deleteAndRefresh$ =
            delete$.pipe(
              takeUntil(this.unsubscribe$),
              finalize(() => {
                this.hideLoader();
                this.toggleAddCollectionForm(true);
                this.redirectToDashboard(this.selectedDmoCollectionName.id);
              }),
              catchError(innerError => { this.resetAddCollectionForm(); return throwError(innerError); }),
              concatMap(() => getAll$.pipe(
                takeUntil(this.unsubscribe$),
                map((response: DmoCollectionShortDto[]) => {
                  this.dmoLists = response;
                  this.resetCollectionsSort(); }))));

          deleteAndRefresh$.subscribe({
            error: (err) => { console.log(`from obs ${err}`); this.toastr.error(err); },
          });
        }
      });
  }

  toggleAddCollectionForm(close = false) {
    if (close) {
      this.showAddButton = true;
    } else {
      this.showAddButton = !this.showAddButton;
    }
    this.resetAddCollectionForm();

    if (!this.showAddButton) {
      setTimeout(() => {
        this.collectionNameField.nativeElement.focus();
      }, 100);
    }
  }

  private resetCollectionsSort() {
    this.collectionsByDefault = false;
    this.collectionsByAcs = false;
    this.collectionsByDesc = true;
    this.sortedDmoLists = [...this.dmoLists];
    this.showSortButton = this.dmoLists.length > 1;
    this.sortingTittle = 'sort by dmos'
  }

  private loadCollections() : Subscription{
    this.showLoader();
    return this.dmoCollectionsService.getCollections()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(
        (response: DmoCollectionShortDto[]) => {
          this.dmoLists = response;
          this.resetCollectionsSort(); 
        },
        (error) => this.toastr.error(error),
        () => this.hideLoader());
  }

  private redirectToDashboard(collectionIdToBeDeleted: string) {
    if (!this.oppenedCollectionId || this.oppenedCollectionId !== collectionIdToBeDeleted) {
      return;
    }
    this.collectionManager.setCollectionId('');
    this.router.navigateByUrl('/');
  }

  private resetAddCollectionForm() {
    this.addCollectionForm.reset();
  }

  private showLoader() {
    this.isFormProcessing = true;
  }

  private hideLoader() {
    this.isFormProcessing = false;
  }

}
