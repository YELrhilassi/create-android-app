import kleur from 'kleur';

export const logger = {
  info: (msg: string) => console.log(kleur.blue('ℹ') + ' ' + msg),
  success: (msg: string) => console.log(kleur.green('✔') + ' ' + msg),
  warn: (msg: string) => console.log(kleur.yellow('⚠') + ' ' + msg),
  error: (msg: string) => console.error(kleur.red('✖') + ' ' + msg),
  step: (msg: string) => console.log(kleur.cyan('→') + ' ' + msg),
  
  // Minimal "Vite-like" output
  banner: () => {
    console.log();
    console.log(kleur.bgGreen().black(' CREATE-DROID '));
    console.log();
  }
};
