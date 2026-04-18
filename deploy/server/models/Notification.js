import { DataTypes } from 'sequelize';

export function defineNotification(sequelize) {
  return sequelize.define('Notification', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { type: DataTypes.STRING },
    title: { type: DataTypes.STRING },
    message: { type: DataTypes.TEXT },
    entity: { type: DataTypes.STRING },
    entity_id: { type: DataTypes.UUID },
    is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
    user_id: { type: DataTypes.UUID },
  }, { tableName: 'notifications' });
}
