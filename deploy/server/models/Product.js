import { DataTypes } from 'sequelize';

export function defineProduct(sequelize) {
  return sequelize.define('Product', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    sku: { type: DataTypes.STRING },
    brand: { type: DataTypes.STRING },
    category: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    buy_price: { type: DataTypes.FLOAT, defaultValue: 0 },
    buy_price_avg: { type: DataTypes.FLOAT, defaultValue: 0 },
    sell_price: { type: DataTypes.FLOAT, defaultValue: 0 },
    quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
    min_stock: { type: DataTypes.INTEGER, defaultValue: 0 },

    image_url: { type: DataTypes.STRING },
    barcode: { type: DataTypes.STRING },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_spare_part: { type: DataTypes.BOOLEAN, defaultValue: false },
    supplier_id: { type: DataTypes.UUID },

    location: { type: DataTypes.STRING },
  }, { tableName: 'products' });
}
