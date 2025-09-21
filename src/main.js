/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;

  // Конвертируем скидку из процентов в десятичную дробь
  const decimalDiscount = discount / 100;

  // Рассчитываем полную стоимость без скидки
  const fullPrice = sale_price * quantity;

  // Рассчитываем выручку с учётом скидки
  const revenue = fullPrice * (1 - decimalDiscount);

  // Округляем до 2 знаков после запятой (копейки)
  return Math.round(revenue * 100) / 100;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  if (profit === undefined || profit === null || profit <= 0) {
    return 0;
  }

  const position = index + 1;

  let bonusPercentage = 0;

  if (position === 1) {
    bonusPercentage = 15;
  } else if (position === 2 || position === 3) {
    bonusPercentage = 10;
  } else if (position === total) {
    bonusPercentage = 0;
  } else {
    bonusPercentage = 5;
  }

  const cashBonus = (profit * bonusPercentage) / 100;

  return Math.round(cashBonus * 100) / 100;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = options;

  // Проверка входных данных
  if (
    !data || typeof data !== 'object' ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records)
  ) {
    throw new Error("Некорректные входные данные");
  }

  // Проверка наличия опций
  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("Не переданы необходимые функции для расчетов");
  }

  // Подготовка промежуточных данных для сбора статистики
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  // Если нет записей о покупках, возвращаем пустую статистику
  if (data.purchase_records.length === 0) {
    return sellerStats.map(seller => ({
      seller_id: seller.id,
      name: seller.name,
      revenue: 0,
      profit: 0,
      sales_count: 0,
      top_products: [],
      bonus: 0
    }));
  }

  // Индексация продавцов и товаров для быстрого доступа
  const sellerIndex = Object.fromEntries(
    sellerStats.map((item) => [item.id, item])
  );

  const productIndex = Object.fromEntries(
    data.products.map((product) => [product.sku, product])
  );

  // Расчет выручки и прибыли для каждого продавца
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];

    if (!seller) {
      throw new Error(`Продавец с ID ${record.seller_id} не найден`);
    }

    seller.sales_count += 1;
    seller.revenue = Math.round((seller.revenue + record.total_amount) * 100) / 100;

    record.items.forEach((item) => {
      const product = productIndex[item.sku];

      if (!product) {
        throw new Error(`Товар с SKU ${item.sku} не найден`);
      }

      const itemRevenue = calculateRevenue(item, product);
      const itemCost = product.purchase_price * item.quantity;
      const itemProfit = Math.round((itemRevenue - itemCost) * 100) / 100;

      seller.profit = Math.round((seller.profit + itemProfit) * 100) / 100;

      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // Сортировка продавцов по прибыли (по убыванию)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Назначение премий на основе ранжирования
  const totalSellers = sellerStats.length;

  sellerStats.forEach((seller, index) => {
    // Расчет бонуса
    seller.bonus = calculateBonus(index, totalSellers, seller);

    // Формирование топ-10 товаров
    const productsArray = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    seller.top_products = productsArray;
  });

  // Подготовка итоговой коллекции с нужными полями
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: seller.revenue,
    profit: seller.profit,
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: seller.bonus,
  }));
}
