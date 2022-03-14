export function loadFile(accept: string = '*/*'): Promise<File> {

    const input = document.createElement('input');
    
    input.type = 'file';
    input.accept = accept;

    return new Promise((resolve, reject) => {
        
        input.addEventListener('change', (e: any) => {
            if (e.target) {
                
                const file = input.files?.[0];
                if (file) {
                    resolve(file);
                }
                
            }
        }, false);
        
        input.click();
    })

}

export function readFileToString(blob: Blob) {

    const fr = new FileReader();

    return new Promise<string>((resolve, reject) => {

        fr.onload = function() {

            resolve(fr.result as string);
        
        }

        fr.readAsText(blob);

    });

}