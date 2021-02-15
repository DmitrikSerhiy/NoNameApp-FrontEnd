import { ElementRef, EventEmitter, QueryList, ViewChildren } from '@angular/core';
import { Component, Input, OnInit, Output } from '@angular/core';
import { BeatDto, DmoDto } from '../../models/editorDtos';
import { TextDetectorService } from '../../helpers/text-detector';

@Component({
  selector: 'app-beats-container',
  templateUrl: './beats-container.component.html',
  styleUrls: ['./beats-container.component.scss']
})
export class BeatContainerComponent implements OnInit {

  @Input() currentDmo: DmoDto;
  @Output() lineCountChanged: EventEmitter<any>;
  @Output() beatsTextChanged: EventEmitter<any[]>;
  @Output() beatAdded: EventEmitter<any>;
  @Output() beatRemoved: EventEmitter<any>;
  @ViewChildren('beatText') beats: QueryList<ElementRef>;
  
  private lineHeigth: number
  private beatContrainerMinHeight: number;

  constructor(
    private textChangeDetector: TextDetectorService) { 
    this.lineHeigth = 16;
    this.beatContrainerMinHeight = 32;
    this.lineCountChanged = new EventEmitter();
    this.beatsTextChanged = new EventEmitter();
    this.beatAdded = new EventEmitter();
    this.beatRemoved = new EventEmitter();
  }

  ngOnInit(): void {
    this.textChangeDetector.textDetector.subscribe((changes: any[]) => {
      this.beatsTextChanged.emit(changes);

      changes.forEach(change => {
        this.beats.forEach(beat => {
          if (beat.nativeElement.getAttribute('id') === `beat_${change.beatId}`) {
            beat.nativeElement.innerText = change.data; //some strange fix of text dublication
          }
        });
      });
    });
  }

  beatPreset($event, beatData: BeatDto) {
    let key = $event.which || $event.keyCode || $event.charCode;
    if ((key == 13 && !key.shiftKey) || key == 13) { //enter or shift + enter
      $event.preventDefault();
      this.beatAdded.emit({ currentBeat: beatData });
      return;
    }

    if (key == 37 || key == 38 || key == 39 || key == 40) { // arrow keys
      if (key == 39) { // to the right
        if (window.getSelection().focusOffset == beatData.beatText.length) {
          this.focusSibling('next', beatData);
          $event.preventDefault();
          return;
        } 
      } else if (key == 37) { // to the left
        if (window.getSelection().focusOffset == 0) {
          this.focusSibling('previous', beatData);
          $event.preventDefault();
          return;
        }
      } else if (key == 38) { // up
        if (window.getSelection().focusOffset == 0) {
          this.focusSibling('previous', beatData);
          $event.preventDefault();
          return;
        }
      } else if (key == 40) { // down
        if (window.getSelection().focusOffset == beatData.beatText.length) {
          this.focusSibling('next', beatData);
          $event.preventDefault();
          return;
        }
      }
    }

    
  }

  beatSet ($event, beatData: BeatDto) {
    let key = $event.which || $event.keyCode || $event.charCode;

    if (key == 37 || key == 38 || key == 39 || key == 40) { // arrow keys
      $event.preventDefault();
      return;
    }

    if (key == 13) { // enter
      $event.preventDefault();
      $event.target.parentNode.nextElementSibling.firstChild.focus();
      return;
    }

    if (key == 8 || key == 46) { //delete or backspace
      if ($event.target.innerText.replace(/\s+/g, '').length == 0) {
        $event.preventDefault();
        this.shiftCursor($event.target.parentNode.previousSibling);
        this.beatRemoved.emit(beatData);
        return;
      }
    }

    if (this.currentDmo.beats.find(b => b.beatId == beatData.beatId).beatText == $event.target.innerText) { // no changes in text
      $event.preventDefault();
      return;
    }

    this.textChangeDetector.detect(beatData.beatId, $event.target.innerText);
    let spanHeight = $event.target.offsetHeight;
    let lines = Math.ceil(spanHeight / this.lineHeigth);
    let newLineCount: number;
    
    if (lines <= 1 ) {
      newLineCount = 1;
    } else { 
      newLineCount = lines % 2 == 0 ? (lines / 2) : Math.floor(lines / 2) + 1;
    }

    if (lines % 2 != 0) {
      if ($event.target.parentNode.style.marginBottom == '0px') {
        let margin = (this.beatContrainerMinHeight * newLineCount) - (lines * this.lineHeigth);
        $event.target.parentNode.style.marginBottom = `${margin}px`;
      }
    } else {
      $event.target.parentNode.style.marginBottom = '0px';
    }

    if (beatData.lineCount < newLineCount) {
        this.lineCountChanged.emit({beatData, newLineCount});

    } else if (beatData.lineCount > newLineCount) {
        this.lineCountChanged.emit({beatData, newLineCount});
    } 
  }

  beatClick ($event: any) {
    if ($event.target.localName == 'div') {
      $event.target.children[0].focus();
      this.shiftCursor($event.target);
    }
  }


  private focusSibling(type: string, beat: BeatDto) {
    let list = this.currentDmo.getBeatsAsLinkedList();
    let clickedBeat = list.search(n => n.beatId == beat.beatId);
    if (clickedBeat == null) {
      return;
    }

    if (type == 'next') {
      if (clickedBeat.next != null) {
        this.getBeatElement(clickedBeat.next.data.beatId).nativeElement.focus();
      }
    } else if (type == 'previous') {
      if (clickedBeat.prev != null) {
        let beatContainer = this.getBeatElement(clickedBeat.prev.data.beatId);
        beatContainer.nativeElement.focus();


        let node = beatContainer.nativeElement.childNodes[0];
        if (node) {
          let selection = window.getSelection();
          var range = document.createRange();
          range.setStart(node, clickedBeat.prev.data.beatText.length);
          range.collapse(true)
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }

  private getBeatElement(beatId: string): ElementRef {
    return this.beats.find(beat => beat.nativeElement.getAttribute('id') === `beat_${beatId}`);
  }

  private shiftCursor(element: any) {
    var range = document.createRange();
    var sel = window.getSelection();
    
    if (element.children[0].innerText.length > 0) {
      range.setStart(element.children[0], 1);
    } else { 
      range.setStart(element.children[0], 0);
    }
    range.collapse(true)

    sel.removeAllRanges();
    sel.addRange(range);
  }

}
