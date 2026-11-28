/**
 * Máquina de estados pura para convivência de áudio e posse do modo de áudio (`setAudioModeAsync`).
 *
 * POSSE DO MODO DE ÁUDIO NO APP MOBILE (`expo-audio` usa um único modo global por app):
 * 1. **Estado normal (`fala === 0` e `gravacaoOuVoz === 0`)**:
 *    `sons.ts` é o dono e aplica `{ playsInSilentMode: false, interruptionMode: 'duckOthers' }`.
 *    Assim os efeitos e o fundo respeitam a chave física de silêncio do iPhone.
 * 2. **Estado de fala / áudio de lição (`fala > 0` e `gravacaoOuVoz === 0`)**:
 *    `aula-formatos.tsx` (ao tocar acorde/batida com `playsInSilentMode: true` ou `expo-speech`)
 *    é o dono do modo. `sons.ts` NÃO altera o modo enquanto `fala > 0` e atenua o fundo (20%).
 *    Ao voltar para 0 em `sairDeFala()`, `sons.ts` reaplica o modo normal (`playsInSilentMode: false`).
 * 3. **Estado de gravação / voz ao vivo (`gravacaoOuVoz > 0`)**:
 *    `aula-formatos.tsx` / `estudio-adaptativo.tsx` / `voz-ao-vivo` são os donos (`allowsRecording: true`).
 *    `sons.ts` NUNCA chama `setAudioModeAsync` enquanto `gravacaoOuVoz > 0`, pausa o fundo imediatamente
 *    e bloqueia todos os SFX exceto `gravacao_inicio` (antes de abrir o microfone) e `gravacao_fim` (após fechar).
 *    Ao voltar para 0 em `sairDeGravacaoOuVoz()`, `sons.ts` reaplica o modo normal.
 */

import type { IdEfeitoSonoro, IdSomFundo, MotivoPausaFundo } from './catalogo-sons';

export type EstadoFundo = 'parado' | 'tocando' | 'atenuado';

export class MaquinaEstadoSom {
  private _efeitosAtivos = true;
  private _fundo: IdSomFundo = 'mudo';
  private _emSegundoPlano = false;
  private _areaPermitida = true;
  private _contFala = 0;
  private _contGravacaoOuVoz = 0;

  get efeitosAtivos(): boolean {
    return this._efeitosAtivos;
  }

  get fundo(): IdSomFundo {
    return this._fundo;
  }

  get emSegundoPlano(): boolean {
    return this._emSegundoPlano;
  }

  get areaPermitida(): boolean {
    return this._areaPermitida;
  }

  get contFala(): number {
    return this._contFala;
  }

  get contGravacaoOuVoz(): number {
    return this._contGravacaoOuVoz;
  }

  definirEfeitosAtivos(ativos: boolean): void {
    this._efeitosAtivos = ativos;
  }

  definirFundo(fundo: IdSomFundo): void {
    this._fundo = fundo;
  }

  definirSegundoPlano(emSegundoPlano: boolean): void {
    this._emSegundoPlano = emSegundoPlano;
  }

  /**
   * Define se a tela atual pode tocar som de fundo (true dentro do app após entrada;
   * false na entrada, recuperação de senha, /t, /p ou ao sair da conta).
   */
  definirAreaPermitida(permitida: boolean): void {
    this._areaPermitida = permitida;
  }

  entrarEmFala(): void {
    this._contFala += 1;
  }

  /** Retorna `true` quando a fala encerrou por completo e não há gravação/voz ativa (hora de reaplicar o modo). */
  sairDeFala(): boolean {
    this._contFala = Math.max(0, this._contFala - 1);
    return this.podeConfigurarModoAgora();
  }

  entrarEmGravacaoOuVoz(): void {
    this._contGravacaoOuVoz += 1;
  }

  /** Retorna `true` quando gravação/voz encerrou por completo e não há fala ativa (hora de reaplicar o modo). */
  sairDeGravacaoOuVoz(): boolean {
    this._contGravacaoOuVoz = Math.max(0, this._contGravacaoOuVoz - 1);
    return this.podeConfigurarModoAgora();
  }

  /** Só `sons.ts` pode chamar `setAudioModeAsync` quando nem fala nem gravação/voz estão ativos. */
  podeConfigurarModoAgora(): boolean {
    return this._contFala === 0 && this._contGravacaoOuVoz === 0;
  }

  /**
   * Em gravação/voz ativa (`contGravacaoOuVoz > 0`), nenhum efeito toca além dos dois bipes
   * (`gravacao_inicio` antes de abrir o microfone e `gravacao_fim` após fechar).
   */
  podeTocarEfeito(id: IdEfeitoSonoro): boolean {
    if (!this._efeitosAtivos) return false;
    if (this._contGravacaoOuVoz > 0) {
      return id === 'gravacao_inicio' || id === 'gravacao_fim';
    }
    return true;
  }

  estadoFundo(): EstadoFundo {
    if (this._fundo === 'mudo' || !this._areaPermitida || this._emSegundoPlano || this._contGravacaoOuVoz > 0) {
      return 'parado';
    }
    if (this._contFala > 0) {
      return 'atenuado';
    }
    return 'tocando';
  }

  motivoPausa(desbloqueado: boolean): MotivoPausaFundo {
    if (this._fundo === 'mudo') return 'nenhum';
    if (!this._areaPermitida) return 'fora_do_app';
    if (this._contGravacaoOuVoz > 0) return 'gravando';
    if (this._emSegundoPlano) return 'segundo_plano';
    if (!desbloqueado) return 'sem_gesto';
    return 'nenhum';
  }
}
