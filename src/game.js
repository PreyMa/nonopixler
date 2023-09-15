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

/**
 * @template T
 * @param {function(...T)} func 
 * @returns {function(...T)}
 */
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

/**
 * Inspired by https://www.enjoyalgorithms.com/blog/first-and-last-positions-of-element-in-sorted-array
 * @template T
 * @template U
 * @param {[T]} array 
 * @param {U} value 
 * @param {function(T,U):number} compareFunc 
 * @returns {number}
 */
function binaryFindFirst(array, value, compareFunc)
{
  let low= 0, high= array.length - 1;
  while( low <= high ) {
    let mid= low+ Math.floor((high - low)/2);
    const comparison= compareFunc(array[mid], value);

    if( (mid === 0 || compareFunc(array[mid - 1], value) < 0) && comparison === 0) {
      return mid;
    } else if(comparison < 0) {
      low= mid + 1;
    } else {
      high= mid - 1;
    }
  }
  return -1;
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

  setText( txt ) {
    this.tableDataElement.innerText= txt;
  }
}

class NumberCell extends Cell {
  constructor(field, elem, segIdx, valueIdx, value) {
    super(field, elem);
    this.segmentIdx= segIdx;
    this.valueIdx= valueIdx;
    this.numberValue= value;
  }

  draw(asError= false) {
    if( asError ) {
      this.tableDataElement.style.color= 'red';
      this.setText( this.numberValue === 0 ? '!' : `${this.numberValue}`);
    } else {
      this.tableDataElement.style.color= '';
      this.setText( this.numberValue === 0 ? '' : `${this.numberValue}`);
    }
  }
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
    this.maxSegmentLength= 1;
    this.numberCellCount= 0;
  }

  insertSegment() {
    this.values[++this.idx]= [0];
    this.numberCellCount++;
    this.lastWasFilled= false;
  }

  insertCell( cell ) {
    if( cell.shouldBeFilled ) {
      const segment= this.values[this.idx];
      if( !this.lastWasFilled ) {
        if( segment[segment.length-1] !== 0 ) {
          segment.push(0);
          this.numberCellCount++;
        }
        this.maxSegmentLength= Math.max(this.maxSegmentLength, segment.length);
      }
      segment[segment.length-1]++;
    }
    this.lastWasFilled= cell.shouldBeFilled;
  }

  forEach( func ) {
    this.values.forEach((segment, segmentIdx) => {
      segment.forEach((value, valueIdx) => {
        const offset= this.maxSegmentLength- segment.length;
        const paddedIdx= valueIdx+ offset;
        func( segmentIdx, valueIdx, paddedIdx, value );
      })
    });
  }
}

class PlayField {
  constructor(rootElem, width, height) {
    this.cells= null;
    this.rowNumberCells= null;
    this.columnNumberCells= null;
    this.rootElement= rootElem;
    this.width= width;
    this.height= height;
    this.rand= new SFC32([32145246, 324842254, 72556325, 27563364]);
    this.showSolution= false;
    this.mouseIsDown= false;
    this.historyStack= new HistoryStack();
    this.didRegisterWindowEvent= false;
    this.currentlyHighlightsErrors= false;

    this.buildField();
  }

  /**
   * 
   * @param {function(TileCell, number, number):boolean} func 
   * @returns 
   */
  forEachCell( func ) {
    for(let y= 0; y< this.height; y++) {
      for(let x= 0; x< this.width; x++) {
        if( func( this.cells[x][y], x, y ) ) {
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

    // The table is larger than the number of tiles to have
    // space for the number cells
    const xlen= rowCounter.maxSegmentLength;
    const ylen= columnCounter.maxSegmentLength;
    const tableWidth= this.width+ xlen;
    const tableHeight= this.height+ ylen;

    // Build the table DOM
    const table= document.createElement('table');
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
        }
      }
    }

    // Allocate arrays for the number cells
    let rowNumberInsertionIdx= 0, columnNumberInsertionIdx= 0;
    this.rowNumberCells= new Array( rowCounter.numberCellCount );
    this.columnNumberCells= new Array( columnCounter.numberCellCount );

    // Insert the number cells ordered by segment then value idx
    columnCounter.forEach((segmentIdx, valueIdx, paddedIdx, value) => {
      const tableCell= table.childNodes[paddedIdx].childNodes[xlen+ segmentIdx];
      const cell= new NumberCell( this, tableCell, segmentIdx, valueIdx, value );
      cell.draw();
      this.columnNumberCells[columnNumberInsertionIdx++]= cell;
    });

    rowCounter.forEach((segmentIdx, valueIdx, paddedIdx, value) => {
      const tableCell= table.childNodes[ylen+ segmentIdx].childNodes[paddedIdx];
      const cell= new NumberCell( this, tableCell, segmentIdx, valueIdx, value );
      cell.draw();
      this.rowNumberCells[rowNumberInsertionIdx++]= cell;
    });

    // Clear out the root element and make the table its sole child
    while(this.rootElement.firstChild) {
      this.rootElement.removeChild(this.rootElement.firstChild);
    }
    this.rootElement.appendChild(table);

    // Add events to detect when cells are colored in
    // Pointer down starts a new action on the history stack
    table.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.mouseIsDown= true;
      if( !this.showSolution ) {
        this.historyStack.beginAction().changeCellByPointerEvent(e);
        this.redrawNumberCellsIfNecessary();
      }
    });

    // Pointer up ends the current action and updates the game state
    if( !this.didRegisterWindowEvent ) {
      window.addEventListener('pointerup', () => {
        if( this.mouseIsDown && !this.showSolution ) {
          this.historyStack.endAction();
          this.update();
        }

        this.mouseIsDown= false;
      });
      this.didRegisterWindowEvent= true;
    }

    // Pointer move tries to add the currently hovered tile to the
    // active history action
    table.addEventListener('pointermove', debounce(e => {
      if( this.mouseIsDown && !this.showSolution) {
        this.historyStack.currentAction().changeCellByPointerEvent(e);
      }
    }), {passive: true})
  }

  isCorrect() {
    return !this.forEachCell( cell => !cell.isCorrect());
  }

  highlightWrongRowAndColumn() {
    this.currentlyHighlightsErrors= this.forEachCell( (cell, x, y) => {
      if( !cell.isCorrect() ) {
        let rowIdx= binaryFindFirst(this.rowNumberCells, y, (a,b) => a.segmentIdx- b);
        let columnIdx= binaryFindFirst(this.columnNumberCells, x, (a,b) => a.segmentIdx- b);
        assert(rowIdx !== -1 && columnIdx !== -1);

        while(rowIdx < this.rowNumberCells.length && this.rowNumberCells[rowIdx].segmentIdx === y) {
          this.rowNumberCells[rowIdx++].draw(true);
        }

        while(columnIdx < this.columnNumberCells.length && this.columnNumberCells[columnIdx].segmentIdx === x) {
          this.columnNumberCells[columnIdx++].draw(true);
        }

        return true;
      }
    });

    if(!this.currentlyHighlightsErrors) {
      this.handleWinState();
    }
  }

  update() {
    if( !this.showSolution && this.isCorrect() ) {
      this.handleWinState();
    }
  }

  handleWinState() {
    alert('You solved it');
  }

  redrawNumberCellsIfNecessary() {
    if(this.currentlyHighlightsErrors) {
      this.rowNumberCells.forEach( cell => cell.draw() );
      this.columnNumberCells.forEach( cell => cell.draw() );

      this.currentlyHighlightsErrors= false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Cell.initCrossImage();

  const gameElement= document.querySelector('.game');
  const field= new PlayField(gameElement, 4, 4);

  const solutionButton= document.getElementById('solution-button');
  const checkButton= document.getElementById('check-button');
  const undoButton= document.getElementById('undo-button');
  const redoButton= document.getElementById('redo-button');

  function updateButtons() {
    undoButton.disabled= field.showSolution || !field.historyStack.canUndo();
    redoButton.disabled= field.showSolution || !field.historyStack.canRedo();
  }

  updateButtons();

  solutionButton.addEventListener('click', e => {
    e.target.innerText= field.toggleSolution() ? 'Hide solution' : 'Show solution';
    updateButtons();
  });

  checkButton.addEventListener('click', () => {
    field.highlightWrongRowAndColumn();
  });

  undoButton.addEventListener('click', e => {
    field.historyStack.undo();
  });

  redoButton.addEventListener('click', e => {
    field.historyStack.redo();
  });

  field.historyStack.addEventListener('action', updateButtons);
});
