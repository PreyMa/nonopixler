'use strict'

const svgCross= `<?xml version="1.0" encoding="iso-8859-1"?>
<svg fill="#FF0000" height="800px" width="800px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 490 490" xml:space="preserve">
  <polygon points="456.851,0 245,212.564 33.149,0 0.708,32.337 212.669,245.004 0.708,457.678 33.149,490 245,277.443 456.851,490 489.292,457.678 277.331,245.004 489.292,32.337 "/>
</svg>`;

function assert(cond, msg= 'Assertion failed') {
  if( !cond ) {
    throw Error( msg );
  }
}

function debounce( func ) {
  let enabled= true;
  return (...args) => {
    if( enabled ) {
      enabled= false;
      window.requestAnimationFrame(() => {
        func(...args);
        enabled= true;
      });
    }
  };
}

class SFC32 {
  constructor(state) {
    if(state.length !== 4) {
      throw Error('Baf SFC32 seed');
    }

    this.a= state[0] >>> 0;
    this.b= state[1] >>> 0;
    this.c= state[2] >>> 0;
    this.d= state[3] >>> 0;
  }

  next() {
    let a= this.a >>> 0;
    let b= this.b >>> 0;
    let c= this.c >>> 0;
    let d= this.d >>> 0; 
    let t = (a + b) | 0;
    
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;

    this.a= a;
    this.b= b;
    this.c= c;
    this.d= d;

    return (t >>> 0) / 4294967296;
  }
}

class HistoryAction {
  constructor(prev) {
    this.nextAction= null;
    this.prevAction= prev;
    if( prev ) {
      prev.nextAction= this;
    }

    this.cellUpdates= [];
    this.newState= Cell.Empty;
  }

  changeCellByPointerEvent( event ) {
    const elem= document.elementFromPoint(event.clientX, event.clientY);
    if( !elem ) {
      return;
    }

    const cell= elem.cellObject;
    if( !(cell instanceof TileCell) ) {
      return;
    }

    const cellAlreadyUpdated= this.cellUpdates.some( update => update.cell === cell );
    if( cellAlreadyUpdated ) {
      return;
    }

    this.cellUpdates.push({
      cell, oldState: cell.currentState
    });

    if( this.cellUpdates.length === 1 ) {
      this.newState= cell.cycleState();
    } else {
      cell.setState( this.newState );
    }
  }

  undo() {
    this.cellUpdates.forEach( update => update.cell.setState(update.oldState) );
  }

  redo() {
    this.cellUpdates.forEach( update => update.cell.setState(this.newState) );
  }

  tryMergeWithPrevious() {
    const prevAction= this.prevAction;
    if( !prevAction ) {
      return false;
    }

    if( prevAction.cellUpdates.length !== this.cellUpdates.length ) {
      return false;
    }

    const actionsUpdatedSameCells= !this.cellUpdates.some(
      newUpdate => !prevAction.cellUpdates.some( oldUpdate => newUpdate.cell === oldUpdate.cell )
    );

    if(!actionsUpdatedSameCells) {
      return false;
    }

    this.prevAction= prevAction.prevAction;
    if( this.prevAction ) {
      this.prevAction.nextAction= this;
    }

    this.cellUpdates.forEach( newUpdate => {
      let oldUpdate= null;
      assert(
        prevAction.cellUpdates.some( update => {
          oldUpdate= update;
          return newUpdate.cell === oldUpdate.cell;
        })
      );

      newUpdate.oldState= oldUpdate.oldState;
    });

    return true;
  }
}

class HistoryStack extends EventTarget {
  constructor() {
    super();
    this._firstAction= null;
    this._lastAction= null;
    this._currentAction= null;
  }

  _emitEvent(type, action) {
    this.dispatchEvent( new CustomEvent('action', {detail: {type, action}}) );
  }

  beginAction() {
    const action= new HistoryAction(this._currentAction);
    if( !this._firstAction || !this._currentAction ) {
      this._firstAction= action;
    }

    this._lastAction= action;
    this._currentAction= action;

    return action;
  }

  endAction() {
    if(this._lastAction) {
      assert(this._lastAction === this._currentAction);

      const didMerge= this._lastAction.tryMergeWithPrevious();
      if( didMerge ) {
        if(!this._lastAction.prevAction) {
          this._firstAction= this._lastAction;
        }
        return;  
      }

      this._emitEvent('do', this._lastAction);
    }
  }

  currentAction() {
    if( !this._lastAction ) {
      throw Error('No action available');
    }

    return this._lastAction;
  }

  canUndo() {
    return !!this._currentAction;
  }

  canRedo() {
    return this._firstAction && this._lastAction && this._currentAction !== this._lastAction;
  }

  undo() {
    if( !this.canUndo() ) {
      return;
    }

    const actionToUndo= this._currentAction;
    actionToUndo.undo();
    this._currentAction= this._currentAction.prevAction;
    
    this._emitEvent('undo', actionToUndo);
  }

  redo() {
    if( !this.canRedo() ) {
      return;
    }

    this._currentAction= this._currentAction ? this._currentAction.nextAction : this._firstAction;
    this._currentAction.redo();
    this._emitEvent('redo', this._currentAction);
  }
}

class Cell {
  static Empty= 0;
  static Filled= 1;
  static Excluded= 2;
  static Solution= 3;

  static toState( x, coloredState= Cell.Filled ) {
    return x ? coloredState : Cell.Empty;
  }

  static cycleState( x ) {
    return x >= Cell.Excluded ? Cell.Empty : x+1;
  }

  static cssCrossImageBackground;
  static initCrossImage() {
    const imageBlob = new Blob([svgCross], {type: 'image/svg+xml'});
    const imageUrl= URL.createObjectURL(imageBlob);
    Cell.cssCrossImageBackground= `url('${imageUrl}')`;
  }

  constructor(field, elem= null) {
    this.tableDataElement= null;
    this.gameField= field;
    this.setElement(elem);
  }

  setElement(elem) {
    if(this.tableDataElement) {
      this.tableDataElement.cellObject= null;
    }
    if( elem ) {
      elem.cellObject= this;
    }
    return this.tableDataElement= elem;
  }

  setColor(color) {
    switch( color ) {
      case Cell.Empty:
        this.tableDataElement.style.background= '';
        break;
      case Cell.Filled:
        this.tableDataElement.style.background= 'blue';
        break;
      case Cell.Excluded:
        this.tableDataElement.style.background= '';
        this.tableDataElement.style.backgroundImage= Cell.cssCrossImageBackground;
        break;
      case Cell.Solution:
        this.tableDataElement.style.background= '#d9ea33';
        break;
      default:
        throw Error('Unknown cell state');
    }
  }

  setNumberValue( val ) {
    this.tableDataElement.innerText= val;
  }
}

class NumberCell extends Cell {
  
}

class TileCell extends Cell {

  constructor( field, rnd ) {
    super( field );
    this.currentState= Cell.Empty;
    this.shouldBeFilled= rnd.next() < 0.3;
  }

  setElement(e) {
    if( super.setElement(e) ) {
      this.tableDataElement.classList.add('tile');
    }
  }

  cycleState() {
    this.currentState= Cell.cycleState(this.currentState);
    this.draw();
    return this.currentState;
  }

  setState( s ) {
    this.currentState= s;
    this.draw();
  }

  draw() {
    if( this.gameField.showSolution ) {
      this.setColor(Cell.toState(this.shouldBeFilled, Cell.Solution));
    } else {
      this.setColor(this.currentState);
    }
  }

  isCorrect() {
    if( this.shouldBeFilled ) {
      return this.currentState === Cell.Filled;
    }

    return this.currentState !== Cell.Filled;
  }
}

class CellCounter {
  constructor( numSegments ) {
    this.values= new Array(numSegments);
    this.lastWasFilled= false;
    this.idx= -1;
    this.maxSegmentLength= 0;
    this.numberCellCount= 0;
  }

  insertSegment() {
    this.values[++this.idx]= [];
    this.lastWasFilled= false;
  }

  insertCell( cell ) {
    if( cell.shouldBeFilled ) {
      const segment= this.values[this.idx];
      if( !this.lastWasFilled ) {
        segment.push(0);
        this.numberCellCount++;
        this.maxSegmentLength= Math.max(this.maxSegmentLength, segment.length);
      }
      segment[segment.length-1]++;
    }
    this.lastWasFilled= cell.shouldBeFilled;
  }

  valueForCoord( segmentIdx, valueIdx ) {
    if( segmentIdx >= this.values.length ) {
      return -1;
    }

    const segment= this.values[segmentIdx];
    const offset= this.maxSegmentLength- segment.length;
    if( valueIdx < offset ) {
      return -1;
    }

    return segment[valueIdx- offset];
  }
}

class PlayField {
  constructor(rootElem, width, height) {
    this.cells= null;
    this.numberCells= null;
    this.rootElement= rootElem;
    this.width= width;
    this.height= height;
    this.rand= new SFC32([32145246, 324842254, 72556325, 27563364]);
    this.showSolution= false;
    this.mouseIsDown= false;
    this.historyStack= new HistoryStack();

    this.buildField();
  }

  forEachCell( func ) {
    for(let x= 0; x< this.width; x++) {
      for(let y= 0; y< this.height; y++) {
        if( func( this.cells[x][y] ) ) {
          return true;
        }
      }
    }

    return false;
  }

  toggleSolution() {
    this.showSolution= !this.showSolution;
    this.forEachCell( cell => cell.draw() );
    return this.showSolution;
  }

  buildField() {
    const columnCounter= new CellCounter(this.width);

    this.cells= new Array(this.width);
    for(let x= 0; x< this.width; x++) {
      this.cells[x]= new Array(this.height);
      columnCounter.insertSegment();
      for(let y= 0; y< this.height; y++) {
        const cell= new TileCell( this, this.rand );
        this.cells[x][y]= cell;
        columnCounter.insertCell( cell );
      }
    }

    // Count the rows
    const rowCounter= new CellCounter(this.height);
    for(let y= 0; y< this.height; y++) {
      rowCounter.insertSegment();
      for(let x= 0; x< this.width; x++) {
        rowCounter.insertCell(this.cells[x][y]);
      }
    }

    this.numberCells= new Array(rowCounter.numberCellCount+ columnCounter.numberCellCount);

    const table= document.createElement('table');

    // The table is larger than the number of tiles to have
    // space for the number cells
    const xlen= rowCounter.maxSegmentLength;
    const ylen= columnCounter.maxSegmentLength;
    const tableWidth= this.width+ xlen;
    const tableHeight= this.height+ ylen;

    for(let y= 0; y< tableHeight; y++) {
      const tableRow= document.createElement('tr');
      table.appendChild(tableRow);

      for(let x= 0; x< tableWidth; x++) {
        const tableCell= document.createElement('td');
        tableRow.appendChild(tableCell);

        // Game tile area
        if( x >= xlen && y >= ylen ) {
          const cell= this.cells[x- xlen][y- ylen];
          cell.setElement(tableCell);

        // Upper number area
        } else if( x >= xlen && y < ylen ) {
          const value= columnCounter.valueForCoord(x- xlen, y);
          if( value !== -1 ) {
            const cell= new NumberCell( this, tableCell );
            cell.setNumberValue(value);
          }

        // Left number area
        } else if( x < xlen && y >= ylen ) {
          const value= rowCounter.valueForCoord(y- ylen, x);
          if( value !== -1 ) {
            const cell= new NumberCell( this, tableCell );
            cell.setNumberValue(value);
          }
        }
      }
    }

    // Clear out the root element and make the table its sole child
    while(this.rootElement.firstChild) {
      this.rootElement.removeChild(this.rootElement.firstChild);
    }
    this.rootElement.appendChild(table);

    table.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.mouseIsDown= true;
      if( !this.showSolution ) {
        this.historyStack.beginAction().changeCellByPointerEvent(e);
      }
    });
    window.addEventListener('pointerup', () => {
      if( this.mouseIsDown && !this.showSolution ) {
        this.historyStack.endAction();
        this.update();
      }

      this.mouseIsDown= false;
    });
    table.addEventListener('pointermove', debounce(e => {
      if( this.mouseIsDown && !this.showSolution) {
        this.historyStack.currentAction().changeCellByPointerEvent(e);
      }
    }), {passive: true})
  }

  isCorrect() {
    return !this.forEachCell( cell => !cell.isCorrect());
  }

  update() {
    if( !this.showSolution && this.isCorrect() ) {
      alert('Oarge sache');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Cell.initCrossImage();

  const gameElement= document.querySelector('.game');
  const field= new PlayField(gameElement, 10, 10);

  const solutionButton= document.getElementById('solution-button');
  const undoButton= document.getElementById('undo-button');
  const redoButton= document.getElementById('redo-button');

  function updateButtons() {
    undoButton.disabled= !field.historyStack.canUndo();
    redoButton.disabled= !field.historyStack.canRedo();
  }

  updateButtons();

  solutionButton.addEventListener('click', e => {
    e.target.innerText= field.toggleSolution() ? 'Hide solution' : 'Show solution';
  });

  undoButton.addEventListener('click', e => {
    field.historyStack.undo();
  });

  redoButton.addEventListener('click', e => {
    field.historyStack.redo();
  });

  field.historyStack.addEventListener('action', updateButtons);
});
