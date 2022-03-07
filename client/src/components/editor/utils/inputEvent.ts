class CustomKeyboardEvent {

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

    onKey(key: string, keydownCb?: (e: KeyboardEvent) => void, keyupCb?: (e: KeyboardEvent) => void) {

        if (keydownCb) {

            window.addEventListener('keydown', (e) => {

                if (e.key === key) {

                    keydownCb(e);

                }

            });

        }

        if (keyupCb) {

            window.addEventListener('keyup', (e) => {

                if (e.key === key) {

                    keyupCb(e);

                }

            });

        }

    }

    onWheel(cb: (e: WheelEvent) => void) {

        window.addEventListener('wheel', (e) => {
           
            cb(e);

        });

    };
}

window.addEventListener('contextmenu', (e) => {

    e.preventDefault();

});

export default new CustomKeyboardEvent();