import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface IQuantityMap {
  [key: string]: number;
}
@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Invalid customer');
    }
    const productsList = await this.productsRepository.findAllById(products);
    if (productsList.length !== products.length) {
      throw new AppError('Invalid product');
    }

    const quantityPerProduct = products.reduce<IQuantityMap>(
      (obj, product) => ({ ...obj, [product.id]: product.quantity }),
      {},
    );

    const productWithInsufficientQuantity = productsList.findIndex(
      product => product.quantity < quantityPerProduct[product.id],
    );

    if (productWithInsufficientQuantity !== -1) {
      throw new AppError('Insufficient stock quantity');
    }

    const productsWithQuantitySubtracted = productsList.map(product => ({
      id: product.id,
      quantity: product.quantity - quantityPerProduct[product.id],
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: productsList.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: quantityPerProduct[product.id],
      })),
    });

    await this.productsRepository.updateQuantity(
      productsWithQuantitySubtracted,
    );

    return order;
  }
}

export default CreateOrderService;
