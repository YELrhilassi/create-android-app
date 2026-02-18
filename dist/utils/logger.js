import kleur from 'kleur';
export const logger = {
    info: (msg) => console.log(kleur.blue('ℹ') + ' ' + msg),
    success: (msg) => console.log(kleur.green('✔') + ' ' + msg),
    warn: (msg) => console.log(kleur.yellow('⚠') + ' ' + msg),
    error: (msg) => console.error(kleur.red('✖') + ' ' + msg),
    step: (msg) => console.log(kleur.cyan('→') + ' ' + msg),
    // Minimal "Vite-like" output
    banner: () => {
        console.log();
        console.log(kleur.bgGreen().black(' CREATE-ANDROID-APP '));
        console.log();
    }
};
