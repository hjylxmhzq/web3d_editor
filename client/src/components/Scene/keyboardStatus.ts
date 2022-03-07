class KeyboardStatus {
  
  public ctrl = false;
  public shift = false;
  public meta = false;
  public space = false;
  constructor() {
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Control': this.ctrl = true; break;
        case 'Shift': this.shift = true; break;
        case 'Meta': this.meta = true; break;
      }
    });
    window.addEventListener('keyup', (e) => {
      switch (e.key) {
        case 'Control': this.ctrl = false; break;
        case 'Shift': this.shift = false; break;
        case 'Meta': this.meta = false; break;
      }
    });
  }
}

export default new KeyboardStatus();