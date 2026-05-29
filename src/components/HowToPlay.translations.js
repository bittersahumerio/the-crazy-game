// Translations for the HOW TO PLAY popup.
// To add a new language: add an entry to LANGUAGES and a matching key in TRANSLATIONS.
// Use <b>...</b> for bold/accent text inside steps.

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
];

export const TRANSLATIONS = {
  en: {
    title: 'HOW TO PLAY',
    steps: [
      'Place a <b>bet</b> in any active game, or <b>host a game yourself</b> from the HOST page.',
      'Each new bet from another player <b>grows your bet’s accumulator</b>. Once it accumulates (bet × ROI%) on top of itself, you can <b>withdraw at bet + ROI</b>.',
      'Every bet <b>resets or extends the timer</b> (depends on the game’s timer mode).',
      'When the timer runs out, the <b>last bettor wins the remaining pool</b> as the jackpot.',
      '<b>Salvador mode</b> (some games): if your bet pushes another player past their ROI threshold, you earn a bonus — a fixed or progressive % of the pool.',
    ],
    footer: 'Tap the {?} icons anywhere on the site, or visit {FAQ} for more details.',
  },

  fr: {
    title: 'COMMENT JOUER',
    steps: [
      'Placez un <b>pari</b> dans une partie active, ou <b>créez votre propre partie</b> depuis la page HOST.',
      'Chaque nouveau pari d’un autre joueur <b>fait croître votre cagnotte personnelle</b>. Quand elle accumule (mise × ROI%) en plus de votre mise, vous pouvez <b>retirer mise + ROI</b>.',
      'Chaque pari <b>réinitialise ou prolonge le minuteur</b> (selon le mode du jeu).',
      'Quand le minuteur expire, le <b>dernier parieur remporte la cagnotte restante</b> en jackpot.',
      '<b>Mode Salvador</b> (certaines parties) : si votre pari pousse un autre joueur au-delà de son seuil ROI, vous gagnez un bonus — un % fixe ou progressif de la cagnotte.',
    ],
    footer: 'Touchez les icônes {?} partout sur le site, ou visitez la {FAQ} pour plus de détails.',
    note: 'Traduction approximative — signalez les erreurs au support.',
  },

  es: {
    title: 'CÓMO JUGAR',
    steps: [
      'Coloca una <b>apuesta</b> en cualquier partida activa, o <b>crea tu propia partida</b> desde la página HOST.',
      'Cada nueva apuesta de otro jugador <b>hace crecer tu acumulador</b>. Cuando acumula (apuesta × ROI%) sobre tu apuesta, puedes <b>retirar apuesta + ROI</b>.',
      'Cada apuesta <b>reinicia o extiende el temporizador</b> (según el modo del juego).',
      'Cuando el temporizador se agota, el <b>último apostador gana el bote restante</b> como jackpot.',
      '<b>Modo Salvador</b> (algunas partidas): si tu apuesta lleva a otro jugador más allá de su umbral ROI, ganas un bono — un % fijo o progresivo del bote.',
    ],
    footer: 'Toca los iconos {?} en cualquier parte del sitio, o visita {FAQ} para más detalles.',
    note: 'Traducción aproximada — informa de errores al soporte.',
  },

  pt: {
    title: 'COMO JOGAR',
    steps: [
      'Faça uma <b>aposta</b> em qualquer jogo ativo, ou <b>crie seu próprio jogo</b> na página HOST.',
      'Cada nova aposta de outro jogador <b>aumenta seu acumulador</b>. Quando acumular (aposta × ROI%) acima da sua aposta, você pode <b>sacar aposta + ROI</b>.',
      'Cada aposta <b>reinicia ou prolonga o cronômetro</b> (depende do modo do jogo).',
      'Quando o cronômetro acaba, o <b>último apostador ganha o bolão restante</b> como jackpot.',
      '<b>Modo Salvador</b> (alguns jogos): se sua aposta empurrar outro jogador além do limite ROI dele, você ganha um bônus — uma % fixa ou progressiva do bolão.',
    ],
    footer: 'Toque nos ícones {?} em qualquer lugar do site, ou visite {FAQ} para mais detalhes.',
    note: 'Tradução aproximada — reporte erros ao suporte.',
  },

  ru: {
    title: 'КАК ИГРАТЬ',
    steps: [
      'Сделайте <b>ставку</b> в любой активной игре, или <b>создайте свою игру</b> на странице HOST.',
      'Каждая новая ставка другого игрока <b>увеличивает накопление вашей</b>. Когда оно накопится сверх вашей ставки, вы можете <b>снять ставку + ROI</b>.',
      'Каждая ставка <b>сбрасывает или продлевает таймер</b> (в зависимости от режима игры).',
      'Когда таймер истекает, <b>последний поставивший выигрывает оставшийся пул</b> в качестве джекпота.',
      'В <b>режиме «Сальвадор»</b>: если ваша ставка помогла другому игроку накопить его ROI, вы получаете бонус — фиксированный или прогрессивный % от пула.',
    ],
    footer: 'Нажимайте на иконки {?} в любом месте сайта, или загляните в {FAQ} за подробностями.',
    note: 'Приблизительный перевод — сообщите об ошибках в поддержке.',
  },

  uk: {
    title: 'ЯК ГРАТИ',
    steps: [
      'Зробіть <b>ставку</b> в будь-якій активній грі, або <b>створіть свою гру</b> на сторінці HOST.',
      'Кожна нова ставка іншого гравця <b>збільшує ваш накопичувач</b>. Коли він накопичить (ставка × ROI%) понад вашу ставку, ви можете <b>зняти ставку + ROI</b>.',
      'Кожна ставка <b>скидає або подовжує таймер</b> (залежить від режиму гри).',
      'Коли таймер закінчується, <b>останній гравець виграє решту пулу</b> як джекпот.',
      '<b>Режим «Сальвадор»</b> (у деяких іграх): якщо ваша ставка штовхнула іншого гравця за його поріг ROI, ви отримуєте бонус — фіксований або прогресивний % від пулу.',
    ],
    footer: 'Натискайте на іконки {?} будь-де на сайті, або зазирніть у {FAQ} для деталей.',
    note: 'Приблизний переклад — повідомте про помилки в підтримку.',
  },

  zh: {
    title: '游戏玩法',
    steps: [
      '在任何活跃的游戏中<b>下注</b>，或在HOST页面<b>创建您自己的游戏</b>。',
      '其他玩家的每次新下注会<b>增加您的累积器</b>。当累积达到 (下注 × ROI%) 时，您可以<b>提取下注 + ROI</b>。',
      '每次下注会<b>重置或延长计时器</b>（取决于游戏的计时模式）。',
      '计时器结束时，<b>最后下注者赢得剩余奖池</b>作为头奖。',
      '<b>Salvador 模式</b>（部分游戏）：如果您的下注让另一位玩家超过他们的 ROI 阈值，您将获得奖励 — 奖池的固定或递增百分比。',
    ],
    footer: '点击网站上任何位置的 {?} 图标，或访问 {FAQ} 获取更多详情。',
    note: '近似翻译 — 如有错误请联系客服。',
  },

  ko: {
    title: '게임 방법',
    steps: [
      '활성화된 게임에 <b>베팅</b>하거나, HOST 페이지에서 <b>직접 게임을 만들 수 있습니다</b>.',
      '다른 플레이어의 각 새로운 베팅은 <b>당신의 누적기를 증가시킵니다</b>. 당신의 베팅에 (베팅 × ROI%)이 누적되면, <b>베팅 + ROI</b>를 인출할 수 있습니다.',
      '모든 베팅은 <b>타이머를 리셋하거나 연장합니다</b> (게임의 타이머 모드에 따라).',
      '타이머가 끝나면, <b>마지막 베팅자가 남은 풀을 잭팟으로</b> 차지합니다.',
      '<b>Salvador 모드</b> (일부 게임): 당신의 베팅이 다른 플레이어의 ROI 임계값을 넘게 하면, 보너스를 받습니다 — 풀의 고정 또는 점진적 비율.',
    ],
    footer: '사이트 어디에서나 {?} 아이콘을 누르거나, {FAQ}를 방문하여 자세한 내용을 확인하세요.',
    note: '근사 번역 — 오류가 있으면 고객지원에 알려주세요.',
  },
};
