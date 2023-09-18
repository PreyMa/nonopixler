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
 * Debounces fast events by synchronizing with the animation frame rate
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
 * Finds the first occurrence of an object in a sorted array with the help
 * of binary search.
 * Inspired by https://www.enjoyalgorithms.com/blog/first-and-last-positions-of-element-in-sorted-array
 * @template T, U
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

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for( let i = 0; i < binaryString.length; i++ ) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(intArray) {
  const bytes = new Uint8Array(intArray);
  const binaryString= String.fromCharCode(...bytes);
  return btoa(binaryString);
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

class GameSettings {
  constructor(width, height, fillRate, seed) {
    this.width= width;
    this.height= height;
    this.fillRate= fillRate;
    this.seed= seed;
    this.serialized= null;
  }

  static withRandomSeed(width, height, fillRate) {
    const seedArray= new Uint32Array(4);
    seedArray[0]= Math.floor(Math.random()* 4294967296);
    seedArray[1]= Math.floor(Math.random()* 4294967296);
    seedArray[2]= Math.floor(Math.random()* 4294967296);
    seedArray[3]= Math.floor(Math.random()* 4294967296);
    const seedString= arrayBufferToBase64( seedArray.buffer );

    return new GameSettings(width, height, fillRate, seedString);
  }

  static fromQueryParam() {
    const url= new URL(window.location);
    const encoded= url.searchParams.get('s');
    if(!encoded) {
      return null;
    }

    try {
      const settings= JSON.parse(atob(encoded));
      const valid=
        typeof settings.width === 'number' &&
        typeof settings.height === 'number' &&
        typeof settings.fillRate === 'number' &&
        typeof settings.seed === 'string' &&
        settings.width > 0 && settings.width <= 20 &&
        settings.height > 0 && settings.height <= 20 &&
        settings.fillRate > 0.15 && settings.fillRate <= 0.85 &&
        settings.seed.length === 24;

      if( !valid ) {
        throw 'validationError';
      }

      return new GameSettings(
        Math.floor(settings.width),
        Math.floor(settings.height),
        settings.fillRate,
        settings.seed
      );

    } catch(e) {
      console.error('Could not decode settings from query param', e);
      throw e;
    }
  }

  serialize() {
    if(this.serialized) {
      return this.serialized;
    }

    return this.serialized= btoa(JSON.stringify({
      width: this.width,
      height: this.height,
      fillRate: this.fillRate,
      seed: this.seed
    }));
  }

  replaceQueryParam() {
    const url= new URL(window.location);
    url.searchParams.set('s', this.serialize())
    window.history.replaceState( null, '', url );
  }
}

class RowColumnNumberSpan {
  constructor(rows, columns, rowIndex, columnIndex) {
    this.rows= rows;
    this.columns= columns;
    this.rowIndex= rowIndex;
    this.columnIndex= columnIndex;
  }

  static findFromTileCoords(rowNumberCells, columnNumberCells, x, y) {
    const rowIdx= binaryFindFirst(rowNumberCells, y, (a,b) => a.segmentIdx- b);
    const columnIdx= binaryFindFirst(columnNumberCells, x, (a,b) => a.segmentIdx- b);
    assert(rowIdx !== -1 && columnIdx !== -1);

    return new RowColumnNumberSpan(rowNumberCells, columnNumberCells, rowIdx, columnIdx);
  }

  forEach( func ) {
    let idx;
    if( this.rows ) {
      idx= this.rowIndex;
      while(idx < this.rows.length && this.rows[idx].segmentIdx === this.rows[this.rowIndex].segmentIdx) {
        func( this.rows[idx++], false );
      }
    }

    if( this.columns ) {
      idx= this.columnIndex;
      while(idx < this.columns.length && this.columns[idx].segmentIdx === this.columns[this.columnIndex].segmentIdx) {
        func( this.columns[idx++], true );
      }
    }
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
    return this.changeCellByElement( document.elementFromPoint(event.clientX, event.clientY) )
  }

  changeCellByElement( elem ) {
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

  clear() {
    this._firstAction= null;
    this._lastAction= null;
    this._currentAction= null;
    this._emitEvent('clear', null);
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

  get x() {
    return this.tableDataElement.cellIndex;
  }

  get y() {
    return this.tableDataElement.parentNode.rowIndex;
  }
}

class NumberCell extends Cell {
  constructor(field, elem, segIdx, valueIdx, value) {
    super(field, elem);
    this.segmentIdx= segIdx;
    this.valueIdx= valueIdx;
    this.numberValue= value;
    this.hasError= false;
    this.isHighlighted= false;
  }

  draw() {
    if( this.hasError ) {
      this.tableDataElement.style.color= 'red';
      this.setText( this.numberValue === 0 ? '!' : `${this.numberValue}`);
    } else {
      this.tableDataElement.style.color= '';
      this.setText( this.numberValue === 0 ? '' : `${this.numberValue}`);
    }

    if( this.isHighlighted ) {
      this.tableDataElement.style.background= 'darkseagreen';
    } else {
      this.tableDataElement.style.background= '';
    }
  }

  setError(enable) {
    this.hasError= enable;
    this.draw();
  }

  setHighlighting(enable) {
    this.isHighlighted= enable;
    this.draw();
  }
}

class TileCell extends Cell {

  constructor( field, rnd, fillRate ) {
    super( field );
    this.currentState= Cell.Empty;
    this.shouldBeFilled= rnd.next() <= fillRate;
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

  isFilled() {
    return this.currentState === Cell.Filled;
  }

  get tileX() {
    return this.x- this.gameField.numberOffsetX;
  }

  get tileY() {
    return this.y- this.gameField.numberOffsetY;
  }
}

class CellCounter {
  constructor( numSegments ) {
    this.values= new Array(numSegments);
    this.clear();
  }

  clear() {
    this.lastWasFilled= false;
    this.idx= -1;
    this.maxSegmentLength= 1;
    this.numberCellCount= 0;
  }

  insertSegment() {
    this.idx++;
    if( Array.isArray(this.values[this.idx]) ) {
      this.values[this.idx].length= 1;
      this.values[this.idx][0]= 0;
    } else {
      this.values[this.idx]= [0];
    }
    this.numberCellCount++;
    this.lastWasFilled= false;
  }

  insertCell( cell, useTargetValue= true ) {
    const cellValue= useTargetValue ? cell.shouldBeFilled : cell.isFilled();
    if( cellValue ) {
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
    this.lastWasFilled= cellValue;
  }

  forEach( func ) {
    return this.values.some((segment, segmentIdx) => {
      return segment.some((value, valueIdx) => {
        const offset= this.maxSegmentLength- segment.length;
        const paddedIdx= valueIdx+ offset;
        return func( segmentIdx, valueIdx, paddedIdx, value );
      })
    });
  }
}

class PlayField {
  constructor(rootElem) {
    this.cells= null;
    this.rowNumberCells= null;
    this.columnNumberCells= null;
    this.rootElement= rootElem;
    this.width= 0;
    this.height= 0;
    this.fillRate= 0;
    this.numberOffsetX= 0;
    this.numberOffsetY= 0;
    this.seed= null;
    this.rand= null;
    this.showSolution= false;
    this.mouseIsDown= false;
    this.historyStack= new HistoryStack();
    this.didRegisterWindowEvent= false;
    this.currentlyHighlightsErrors= false;
    this.squaredMode= false;
    this.enableDrawing= true;
    this.lastRowColumnHighlight= null;
    this.allowAlternativeSolutions= false;
  }

  clear() {
    this.cells= null;
    this.rowNumberCells= null;
    this.columnNumberCells= null;
    this.numberOffsetX= 0;
    this.numberOffsetY= 0;
    this.seed= null;
    this.rand= null;
    this.showSolution= false;
    this.mouseIsDown= false;
    this.historyStack.clear();
    this.currentlyHighlightsErrors= false;
    this.lastRowColumnHighlight= null;
    this.allowAlternativeSolutions= false;
  }

  initWithSettings(settings) {
    this.clear();
    this.width= settings.width* 5;
    this.height= settings.height* 5;
    this.fillRate= settings.fillRate;
    this.seed= settings.seed;

    const seedArray= new Uint32Array(base64ToArrayBuffer(this.seed));
    this.rand= new SFC32([...seedArray]);

    this.buildField();
  }

  reset() {
    this.initWithSettings(new GameSettings(this.width/5, this.height/5, this.seed));
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

  get table() {
    return this.rootElement.firstElementChild;
  }

  toggleSolution() {
    this.showSolution= !this.showSolution;
    this.forEachCell( cell => cell.draw() );
    return this.showSolution;
  }

  setSquaredMode( enable ) {
    this.squaredMode= enable;
    this.table.classList.toggle('squared', enable);
  }

  setDrawMode( enable ) {
    this.enableDrawing= enable;
    this.table.classList.toggle('no-draw', !enable);
  }

  buildField() {
    const columnCounter= new CellCounter(this.width);

    this.cells= new Array(this.width);
    for(let x= 0; x< this.width; x++) {
      this.cells[x]= new Array(this.height);
      columnCounter.insertSegment();
      for(let y= 0; y< this.height; y++) {
        const cell= new TileCell( this, this.rand, this.fillRate );
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
    const xlen= this.numberOffsetX= rowCounter.maxSegmentLength;
    const ylen= this.numberOffsetY= columnCounter.maxSegmentLength;
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
    this.setSquaredMode(this.squaredMode);

    // Add events to detect when cells are colored in
    // Pointer down starts a new action on the history stack
    table.addEventListener('pointerdown', e => {
      this.handlePointerDown(e);
    });

    // Pointer up ends the current action and updates the game state
    if( !this.didRegisterWindowEvent ) {
      window.addEventListener('pointerup', () => {
        this.handlePointerUp();
      });
      this.didRegisterWindowEvent= true;
    }

    // Pointer move tries to add the currently hovered tile to the
    // active history action
    table.addEventListener('pointermove', debounce(e => {
      this.handlePointerMove( e );
    }), {passive: true})

    table.addEventListener('pointerleave', e => {
      this.handlePointerLeave(e);
    })

    table.addEventListener('click', e => {
      this.handlePointerClick( e );
    });
  }

  handlePointerDown( e ) {
    const elem= document.elementFromPoint(e.clientX, e.clientY);

    if( this.enableDrawing ) {
      e.preventDefault();
      this.mouseIsDown= true;
      if( !this.showSolution ) {
        this.historyStack.beginAction().changeCellByElement( elem );
        this.redrawNumberCellsIfNecessary();
      }
    }

    this.updateRowColumnHighlightByElement( elem );
  }

  handlePointerUp() {
    if( this.enableDrawing && this.mouseIsDown && !this.showSolution ) {
      this.historyStack.endAction();
      this.update();
    }

    this.mouseIsDown= false;
  }

  handlePointerMove( e ) {
    const elem= document.elementFromPoint(e.clientX, e.clientY);

    if( this.enableDrawing && this.mouseIsDown && !this.showSolution) {
      this.historyStack.currentAction().changeCellByElement( elem );
    }

    this.updateRowColumnHighlightByElement( elem );
  }

  handlePointerLeave( e ) {
    this.updateRowColumnHighlightByElement( null );
  }

  handlePointerClick( e ) {
    if( !this.enableDrawing && !this.showSolution ) {
      this.historyStack.beginAction().changeCellByPointerEvent(e);
      this.historyStack.endAction();
      this.redrawNumberCellsIfNecessary();
      this.update();
    }
  }

  updateRowColumnHighlightByElement( elem ) {
    if( this.lastRowColumnHighlight ) {
      this.lastRowColumnHighlight.forEach( cell => cell.setHighlighting(false) );
      this.lastRowColumnHighlight= null;
    }

    if( !elem || !(elem.cellObject instanceof TileCell) ) {
      return;
    }

    const tileCell= elem.cellObject;
    const rowColumnSpan= RowColumnNumberSpan.findFromTileCoords(this.rowNumberCells, this.columnNumberCells, tileCell.tileX, tileCell.tileY);
    rowColumnSpan.forEach( cell => cell.setHighlighting(true) );
    this.lastRowColumnHighlight= rowColumnSpan;
  }

  findBadNumberCellSpan() {
    const checkSegments= (numSegments, segmentLength, switchAxis, numberCells, func) => {
      // Go through all segments and validate each
      let readIdx= 0, prevBeginSegmentIdx= 0;
      const counter= new CellCounter(1);
      for(let i= 0; i!== numSegments; i++) {
        // Insert all cells of the segment to build the cell counter
        counter.clear();
        counter.insertSegment();
        for(let j= 0; j !== segmentLength; j++) {
          counter.insertCell( switchAxis ? this.cells[j][i] : this.cells[i][j], false);
        }

        // Check if all the counted blocks match the ones in the sorted number cells array
        const beginSegmentIdx= readIdx;
        let errorSpan= null;
        counter.forEach((segmentIdx, valueIdx, paddedIdx, value) => {
          // Too many blocks overall
          if( readIdx >= numberCells.length ) {
            return errorSpan= func(beginSegmentIdx);
          }
          // Too little blocks in the previous segment -> the number cell is still
          // at a lower index than the current index
          const cell= numberCells[readIdx];
          if( cell.segmentIdx < i ) {
            return errorSpan= func(prevBeginSegmentIdx);
          }
          // All the rest
          if( cell.segmentIdx > i || cell.valueIdx !== valueIdx || cell.numberValue !== value ) {
            return errorSpan= func(beginSegmentIdx);
          }
          readIdx++;
          return null;
        });

        if( errorSpan ) {
          return errorSpan;
        }
        prevBeginSegmentIdx= beginSegmentIdx;
      }
      return null;
    };

    // Check all the columns
    let errorSpan= checkSegments(
      this.width, this.height, false, this.columnNumberCells,
      beginSegmentIdx => new RowColumnNumberSpan(null, this.columnNumberCells, 0, beginSegmentIdx )
    );

    if( errorSpan ) {
      return errorSpan
    }

    // Check all the rows
    errorSpan= checkSegments(
      this.height, this.width, true, this.rowNumberCells,
      beginSegmentIdx => new RowColumnNumberSpan(this.rowNumberCells, null, beginSegmentIdx, 0 )
    );


    return errorSpan;
  }

  isCorrect() {
    if( !this.allowAlternativeSolutions ) {
      return !this.forEachCell( cell => !cell.isCorrect());
    }

    return this.findBadNumberCellSpan() === null;
  }

  highlightWrongRowAndColumn() {
    this.redrawNumberCellsIfNecessary();

    if( this.allowAlternativeSolutions ) {
      const rowColumnSpan= this.findBadNumberCellSpan();
      this.currentlyHighlightsErrors= !!rowColumnSpan;
      if( rowColumnSpan ) {
        rowColumnSpan.forEach( cell => cell.setError(true) );
      }
    } else {
      this.currentlyHighlightsErrors= this.forEachCell( (cell, x, y) => {
        if( !cell.isCorrect() ) {
          const rowColumnSpan= RowColumnNumberSpan.findFromTileCoords(this.rowNumberCells, this.columnNumberCells, x, y);
          rowColumnSpan.forEach( cell => cell.setError(true) );
  
          return true;
        }
      });
    }

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
    if( this.onWinState ) {
      this.onWinState();
    }
  }

  redrawNumberCellsIfNecessary() {
    if(this.currentlyHighlightsErrors) {
      this.rowNumberCells.forEach( cell => cell.setError(false) );
      this.columnNumberCells.forEach( cell => cell.setError(false) );

      this.currentlyHighlightsErrors= false;
    }
  }
}

function setupModal( name, setupFunc, handlerFunc ) {
  const openButton= document.getElementById(name+ '-button');
  const dialog= document.getElementById(name+ '-dialog');
  const form= dialog.querySelector('form');
  const cancelButton= form.querySelector('button.cancel');
  assert(openButton && dialog && form, 'Missing modal element');

  // The open button shows the dialog. An optional setup function
  // inits the dialog and form elements
  let actualReturnData= null;
  openButton.addEventListener('click', () => {
    dialog.returnValue= 'cancel';
    actualReturnData= null;

    if( setupFunc ) {
      setupFunc(dialog, form);
    }

    dialog.showModal();
  });

  // If a cancel button exists it closes the dialog without a value
  if( cancelButton ) {
    cancelButton.addEventListener('click', () => dialog.close( 'cancel' ));
  }

  // When the form is submitted via hitting return or submit button, the
  // form field names and contents are packed into an object to be returned 
  // later and the dialog is closed
  form.addEventListener('submit', e => {
    e.preventDefault();

    actualReturnData= {};
    for( let i = 0; i < form.elements.length; i++ ) {
      const input= form.elements[i];
      if( input.nodeName.toLowerCase() === "input" ) {
        let value= input.value;
        if( input.type.toLowerCase() === 'number' ) {
          value= parseFloat(value);
        }
        actualReturnData[input.name]= value;
      }
    }

    dialog.close( 'ok' );
    return false;
  });

  // When the dialog closes data is returned if it exists
  dialog.addEventListener('close', () => {
    if( dialog.returnValue === 'cancel' ) {
      handlerFunc( null );
    } else {
      handlerFunc( actualReturnData );
    }
  });

  return dialog;
}

document.addEventListener('DOMContentLoaded', () => {
  Cell.initCrossImage();

  const gameElement= document.querySelector('.game');
  const field= new PlayField(gameElement);

  const solutionButton= document.getElementById('solution-button');
  const checkButton= document.getElementById('check-button');
  const undoButton= document.getElementById('undo-button');
  const redoButton= document.getElementById('redo-button');
  const squareFieldsCheckbox= document.getElementById('square-fields-checkbox');
  const enableDrawingCheckbox= document.getElementById('enable-drawing-checkbox');
  const alternativeSolutionsCheckbox= document.getElementById('alternative-solutions-checkbox')
  const badLinkDialog= document.getElementById('bad-link-dialog');
  const winDialog= document.getElementById('win-dialog');

  function updateButtons() {
    undoButton.disabled= field.showSolution || !field.historyStack.canUndo();
    redoButton.disabled= field.showSolution || !field.historyStack.canRedo();
    solutionButton.innerText= field.showSolution ? 'Hide solution' : 'Show solution';
  }

  updateButtons();

  function newRandomGame(width, height, fillRate) {
    const settings= GameSettings.withRandomSeed(width, height, fillRate);
    settings.replaceQueryParam();
    field.initWithSettings( settings );
    updateButtons();
  }

  function loadSettings() {
    const settingsString= localStorage.getItem('settings');
    if( settingsString ) {
      try {
        const settings= JSON.parse(settingsString);
        field.setSquaredMode( squareFieldsCheckbox.checked= !!settings.squareFields );
        field.setDrawMode( enableDrawingCheckbox.checked= !!settings.enableDrawing );
        field.allowAlternativeSolutions= alternativeSolutionsCheckbox.checked= !!settings.alternativeSolutions;
      } catch( e ) {
        console.error('Could not parse settings:', e);
      }
    }
  }

  function saveSettings() {
    localStorage.setItem('settings', JSON.stringify({
      squareFields: squareFieldsCheckbox.checked,
      enableDrawing: enableDrawingCheckbox.checked,
      alternativeSolutions: alternativeSolutionsCheckbox.checked
    }));
  }

  solutionButton.addEventListener('click', e => {
    field.toggleSolution();
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

  squareFieldsCheckbox.addEventListener('change', () => {
    field.setSquaredMode( squareFieldsCheckbox.checked );
    saveSettings();
  });

  enableDrawingCheckbox.addEventListener('change', () => {
    field.setDrawMode( enableDrawingCheckbox.checked );
    saveSettings();
  });

  alternativeSolutionsCheckbox.addEventListener('change', () => {
    field.allowAlternativeSolutions= alternativeSolutionsCheckbox.checked;
    saveSettings();
  });

  setupModal('reset-game', null, doReset => {
    if(doReset) {
      field.reset();
    }
  });

  setupModal('new-game', (dialog, form) => {
    function updateSlider() {
      form.fillRate.parentNode.nextElementSibling.innerText= form.fillRate.value+ '%';
    }

    updateSlider();

    form.width.value= Math.max(1, Math.floor(field.width/5));
    form.height.value= Math.max(1, Math.floor(field.height/5));
    form.width.onchange= form.height.onchange= () => {
      const x= form.width.value* form.height.value;
      form.fillRate.value= Math.max(Math.min(-0.0002827*x*x +0.2261*x+ 39.77, 85), 15);
      updateSlider();
    };
    form.fillRate.oninput= updateSlider;
  }, settings => {
    if( settings ) {
      newRandomGame(settings.width, settings.height, settings.fillRate/100);
    }
  });

  badLinkDialog.addEventListener('close', () => {
    newRandomGame(1, 1, 0.4);
    loadSettings();
  });

  field.onWinState= () => winDialog.showModal();

  try {
    const settings= GameSettings.fromQueryParam();
    if( settings ) {
      console.log('Settings from query params:', settings);
      field.initWithSettings(settings);
    } else {
      console.log('Generate new settings:', settings);
      newRandomGame(1, 1, 0.4);
    }
    loadSettings();
  } catch( e ) {
    document.getElementById('bad-link-dialog-message').innerText= (e === 'validationError')
      ? 'The URL is missing data. Maybe it is too old.'
      : 'The data is malformed. Maybe you missed some characters when copy-pasting.';
      badLinkDialog.showModal();
  }


  /*const a= new Uint32Array(4);
  a[0]= 32145246;
  a[1]= 324842254;
  a[2]= 72556325;
  a[3]= 27563364;
  field.initWithSettings(new GameSettings(10, 10, arrayBufferToBase64(a.buffer)));*/
});
