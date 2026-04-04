import { DataTypes } from 'sequelize';

export function defineStockMovement(sequelize) {
  return sequelize.define('StockMovement', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    product_id: { type: DataTypes.UUID },
    product_name: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING }, // 'entree', 'sortie', 'ajustement'
    quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
    previous_stock: { type: DataTypes.INTEGER },
    new_stock: { type: DataTypes.INTEGER },
    reason: { type: DataTypes.STRING },
    reference_type: { type: DataTypes.STRING }, // 'vente', 'achat', 'reparation'
    reference_id: { type: DataTypes.UUID },
    user: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
  }, { tableName: 'stock_movements' });
}
