'use strict'

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

class Cell {
  static Empty= 0;
  static Filled= 1;
  static Excluded= 2;
  static Solution= 3;

  static toState( x, coloredState= Cell.Filled ) {
    return x ? coloredState : Cell.Empty;
  }

  constructor(elem= null) {
    this.tableDataElement= elem;
  }

  setElement(elem) {
    return this.tableDataElement= elem;
  }

  setColor(color) {
      this.tableDataElement.style.background= 'red';
    switch( color ) {
      case Cell.Empty:
        this.tableDataElement.style.background= '';
        break;
      case Cell.Filled:
        this.tableDataElement.style.background= 'blue';
        break;
      case Cell.Excluded:
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const gameElement= document.querySelector('.game');
  const field= new PlayField(gameElement, 10, 10);

  const solutionButton= document.getElementById('solution-button');

  solutionButton.addEventListener('click', e => {
    e.target.innerText= field.toggleSolution() ? 'Hide solution' : 'Show solution';
  });
});
