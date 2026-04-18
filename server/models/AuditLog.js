import { DataTypes } from 'sequelize';

export function defineAuditLog(sequelize) {
  return sequelize.define('AuditLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID },
    user_email: { type: DataTypes.STRING },
    action: { type: DataTypes.STRING },
    entity: { type: DataTypes.STRING },
    entity_id: { type: DataTypes.UUID },
    details: { type: DataTypes.JSON },
    ip_address: { type: DataTypes.STRING },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  }, { tableName: 'audit_logs' });
}
