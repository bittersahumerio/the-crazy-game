/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/crazy_game_vanilla.json`.
 */
export type CrazyGameVanilla = {
  "address": "BcXdHwCZsXva93X92wV8S9jPJUnsu4XSiNGFwhCNcjuz",
  "metadata": {
    "name": "crazyGameVanilla",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimJackpot",
      "discriminator": [
        28,
        214,
        134,
        248,
        249,
        81,
        206,
        198
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.host",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.name",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "claimant",
          "writable": true,
          "signer": true
        },
        {
          "name": "claimantTokenAccount",
          "writable": true
        },
        {
          "name": "gameVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "defaultFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeGame",
      "discriminator": [
        44,
        62,
        102,
        247,
        126,
        208,
        130,
        215
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "initialBet",
          "writable": true
        },
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "hostTokenAccount",
          "writable": true
        },
        {
          "name": "gameVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "platformVault",
          "writable": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "initialDeposit",
          "type": "u64"
        },
        {
          "name": "minBet",
          "type": "u64"
        },
        {
          "name": "roiBps",
          "type": "u64"
        },
        {
          "name": "timerDuration",
          "type": "i64"
        },
        {
          "name": "hostFeeBps",
          "type": "u64"
        },
        {
          "name": "timerMode",
          "type": "u8"
        },
        {
          "name": "timeIncrement",
          "type": "i64"
        }
      ]
    },
    {
      "name": "placeBet",
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.host",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.name",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              },
              {
                "kind": "account",
                "path": "game.bet_count",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerTokenAccount",
          "writable": true
        },
        {
          "name": "gameVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "platformVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "removeTokenFee",
      "discriminator": [
        117,
        180,
        47,
        252,
        100,
        201,
        21,
        20
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "mint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "reserveRoi",
      "discriminator": [
        13,
        37,
        132,
        36,
        89,
        91,
        37,
        93
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.host",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.name",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              },
              {
                "kind": "account",
                "path": "bet.bet_index",
                "account": "bet"
              }
            ]
          }
        },
        {
          "name": "caller",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "setTokenFee",
      "discriminator": [
        219,
        237,
        16,
        50,
        227,
        85,
        231,
        243
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "mint",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateDefaultFee",
      "discriminator": [
        158,
        171,
        96,
        160,
        151,
        60,
        226,
        146
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "defaultFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.host",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.name",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              },
              {
                "kind": "account",
                "path": "bet.bet_index",
                "account": "bet"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerTokenAccount",
          "writable": true
        },
        {
          "name": "gameVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "bet",
      "discriminator": [
        147,
        23,
        35,
        59,
        15,
        75,
        155,
        32
      ]
    },
    {
      "name": "game",
      "discriminator": [
        27,
        90,
        166,
        125,
        74,
        100,
        121,
        18
      ]
    },
    {
      "name": "platformConfig",
      "discriminator": [
        160,
        78,
        128,
        0,
        248,
        83,
        230,
        160
      ]
    }
  ],
  "events": [
    {
      "name": "betPlaced",
      "discriminator": [
        88,
        88,
        145,
        226,
        126,
        206,
        32,
        0
      ]
    },
    {
      "name": "gameCreated",
      "discriminator": [
        218,
        25,
        150,
        94,
        177,
        112,
        96,
        2
      ]
    },
    {
      "name": "jackpotClaimed",
      "discriminator": [
        141,
        206,
        247,
        184,
        235,
        71,
        241,
        231
      ]
    },
    {
      "name": "playerWithdrew",
      "discriminator": [
        148,
        107,
        50,
        109,
        222,
        237,
        34,
        250
      ]
    },
    {
      "name": "roiReserved",
      "discriminator": [
        46,
        0,
        135,
        248,
        158,
        45,
        30,
        54
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidName",
      "msg": "Invalid game name — must be 3-30 characters"
    },
    {
      "code": 6001,
      "name": "invalidDeposit",
      "msg": "Invalid initial deposit"
    },
    {
      "code": 6002,
      "name": "invalidMinBet",
      "msg": "Invalid minimum bet"
    },
    {
      "code": 6003,
      "name": "invalidRoi",
      "msg": "Invalid ROI — must be between 10% and 1000%"
    },
    {
      "code": 6004,
      "name": "invalidTimer",
      "msg": "Invalid timer duration"
    },
    {
      "code": 6005,
      "name": "invalidHostFee",
      "msg": "Invalid host fee — must be between 1% and 5%"
    },
    {
      "code": 6006,
      "name": "invalidTimerMode",
      "msg": "Invalid timer mode"
    },
    {
      "code": 6007,
      "name": "farmingProtection",
      "msg": "Game parameters too easy to farm"
    },
    {
      "code": 6008,
      "name": "gameNotActive",
      "msg": "Game is not active"
    },
    {
      "code": 6009,
      "name": "betTooSmall",
      "msg": "Bet amount is below minimum"
    },
    {
      "code": 6010,
      "name": "timerExpired",
      "msg": "Timer has expired"
    },
    {
      "code": 6011,
      "name": "roiNotReached",
      "msg": "ROI target not yet reached"
    },
    {
      "code": 6012,
      "name": "alreadyReserved",
      "msg": "Bet already reserved"
    },
    {
      "code": 6013,
      "name": "alreadyWithdrawn",
      "msg": "Bet already withdrawn"
    },
    {
      "code": 6014,
      "name": "notReserved",
      "msg": "Bet is not reserved"
    },
    {
      "code": 6015,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6016,
      "name": "notLastBettor",
      "msg": "Only the last bettor can claim the jackpot"
    },
    {
      "code": 6017,
      "name": "jackpotAlreadyClaimed",
      "msg": "Jackpot already claimed"
    },
    {
      "code": 6018,
      "name": "jackpotDelayNotMet",
      "msg": "Jackpot delay not yet met — wait 5 minutes after timer expires"
    },
    {
      "code": 6019,
      "name": "emptyJackpot",
      "msg": "Jackpot is empty"
    },
    {
      "code": 6020,
      "name": "invalidFee",
      "msg": "Invalid fee — must be between 0% and 10%"
    },
    {
      "code": 6021,
      "name": "tooManyTokenFees",
      "msg": "Too many token fee overrides"
    }
  ],
  "types": [
    {
      "name": "bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "betIndex",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "netAmount",
            "type": "u64"
          },
          {
            "name": "roiTarget",
            "type": "u64"
          },
          {
            "name": "accumulatedBase",
            "type": "u64"
          },
          {
            "name": "cumulativeAtJoin",
            "type": "u64"
          },
          {
            "name": "reserved",
            "type": "bool"
          },
          {
            "name": "withdrawn",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "betPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "betIndex",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "netAmount",
            "type": "u64"
          },
          {
            "name": "timerEnd",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "host",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "initialDeposit",
            "type": "u64"
          },
          {
            "name": "poolAmount",
            "type": "u64"
          },
          {
            "name": "minBet",
            "type": "u64"
          },
          {
            "name": "roiBps",
            "type": "u64"
          },
          {
            "name": "timerDuration",
            "type": "i64"
          },
          {
            "name": "hostFeeBps",
            "type": "u64"
          },
          {
            "name": "platformFeeBps",
            "type": "u64"
          },
          {
            "name": "timerMode",
            "type": "u8"
          },
          {
            "name": "timeIncrement",
            "type": "i64"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "timerEnd",
            "type": "i64"
          },
          {
            "name": "poolBalance",
            "type": "u64"
          },
          {
            "name": "reservedBalance",
            "type": "u64"
          },
          {
            "name": "cumulativePerBet",
            "type": "u64"
          },
          {
            "name": "lastBettor",
            "type": "pubkey"
          },
          {
            "name": "betCount",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "jackpotClaimed",
            "type": "bool"
          },
          {
            "name": "platformFeesCollected",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gameCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "host",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "initialDeposit",
            "type": "u64"
          },
          {
            "name": "minBet",
            "type": "u64"
          },
          {
            "name": "roiBps",
            "type": "u64"
          },
          {
            "name": "timerDuration",
            "type": "i64"
          },
          {
            "name": "hostFeeBps",
            "type": "u64"
          },
          {
            "name": "platformFeeBps",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "jackpotClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "claimant",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "platformConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "defaultFeeBps",
            "type": "u16"
          },
          {
            "name": "tokenFees",
            "type": {
              "vec": {
                "defined": {
                  "name": "tokenFee"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "playerWithdrew",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "betIndex",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "roiReserved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "betIndex",
            "type": "u64"
          },
          {
            "name": "roiTarget",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenFee",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          }
        ]
      }
    }
  ]
};
