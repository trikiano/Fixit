import { DataTypes } from 'sequelize';

export const defineDeviceModel = (sequelize) => {
  return sequelize.define('DeviceModel', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    device_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  });
};
