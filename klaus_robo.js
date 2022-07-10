const fs = require("fs");

const foundsTotal = 0.3;
const priceLimit = 0.953;
const priceStop = 0.951;
const priceTarget = 1.02;

async function storeData(data, path) {
  try {
    fs.writeFileSync(path, JSON.stringify(data));
  } catch (err) {
    console.error(err);
  }
}

async function createOrder(buyCoin, quantity, client, binanceInfo, coinPrice) {
  let coinInfo = binanceInfo.symbols.find((s) => s.symbol === buyCoin.symbol);

  let minPrice = coinInfo.filters.find(
    (filtro) => filtro.filterType === "PRICE_FILTER"
  ).minPrice;

  let minQty = coinInfo.filters.find(
    (filtro) => filtro.filterType === "LOT_SIZE"
  ).minQty;

  let floatValue = minPrice.toString().split(".")[1].split("1")[0];
  let priceSize = floatValue.length + 1;
  let floatSize = minQty.toString().split(".")[1].split("1")[0];
  let qtdSize = floatSize.length + 1;
  quantity = quantity.toFixed(qtdSize);
  quantity = Math.round(quantity, qtdSize);

  let savingOrder = {
    order: {
      symbol: buyCoin.symbol,
      side: "BUY",
      quantity,
      type: "MARKET",
    },
    aditionalInfos: {
      coinPrice,
    },
  };

  storeData(savingOrder, "orders/MARKET-" + buyCoin.symbol + ".json");

  let stopPrice = coinPrice * priceLimit.toFixed(priceSize);
  let sellPrice = coinPrice * priceStop.toFixed(priceSize);
  let sellPriceOco = coinPrice * priceTarget.toFixed(priceSize);

  let ocoOrderObj = {
    symbol: buyCoin.symbol,
    side: "SELL",
    quantity: quantity,
    price: sellPriceOco,
    stopPrice: stopPrice,
    stopLimitPrice: sellPrice,
  };

  storeData(ocoOrderObj, "orders/OCO-" + buyCoin.symbol + ".json");
}

function checkIfIsRedCandle(candleObj) {
  let close = parseFloat(candleObj.close);
  let open = parseFloat(candleObj.open);

  if (close < open) {
    return true;
  }
  return false;
}

function engolfando(candles) {
  if (
    parseFloat(candles[candles.length - 1].open) <=
      parseFloat(candles[candles.length - 2].close) &&
    parseFloat(candles[candles.length - 1].close) >
      parseFloat(candles[candles.length - 2].open) &&
    checkIfIsRedCandle(candles[candles.length - 2]) &&
    !checkIfIsRedCandle(candles[candles.length - 1])
  ) {
    return true;
  }
  return false;
}

function createCoins(client, infos) {
  let symbols = infos["symbols"];
  let symbolList = symbols.filter(
    (s) => s.quoteAsset === "BTC" && s.status === "TRADING"
  );

  var coinList = symbolList.map(function (el) {
    return el.symbol;
  });

  function createEachCoin(coin) {
    return new Promise(async (resolve) => {
      let candlesMenores = await client
        .candles({
          symbol: coin,
          interval: "4h",
          limit: 2,
        })
        .catch((erro) => {
          console.log("erro" + erro);
          return [];
        });

      if (candlesMenores.length > 0 && engolfando(candlesMenores)) {
        let symbol = await client
          .dailyStats({
            symbol: coin,
          })
          .catch((erro) => {
            console.log("erro" + erro);
            return [];
          });

        let price = parseFloat(symbol.lastPrice);
        let quantity = foundsTotal / (price * 0.99);

        createOrder(symbol, quantity, client, infos, symbol.lastPrice);
        resolve({ coin, comprou: true });
      } else {
        resolve({ coin, comprou: false });
      }
    });
  }
  const promiseAll = [...coinList.map((coin) => createEachCoin(coin))];
  return Promise.all(promiseAll);
}

module.exports = {
  async getCoins(client, binanceInfo) {
    createCoins(client, binanceInfo)
      .then((promises) => {
        let compradas = promises.filter((p) => p.comprou);
        let naoCompradas = promises.filter((p) => !p.comprou);
        compradas.forEach(({ coin, comprou }) =>
          console.log("moeda: " + coin + " comprou: " + comprou)
        );
        console.log("\n");
        let dataNow = new Date();
        console.log("ultima verificação: " + dataNow.toISOString());
        console.log("nao compradas: " + naoCompradas.length);
        console.log("compradas: " + compradas.length);
        console.log("\n");
      })
      .catch((err) => {
        console.log(err);
        console.log("\n");
        console.log("\n");
      });
  },
};
