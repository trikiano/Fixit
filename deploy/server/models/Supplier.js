import { DataTypes } from 'sequelize';

export function defineSupplier(sequelize) {
  return sequelize.define('Supplier', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    contact_name: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT },
    website: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'suppliers' });
}
