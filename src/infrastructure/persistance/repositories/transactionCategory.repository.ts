import { Injectable, Inject } from '@nestjs/common';
import IRepository from '../../../core/domain/repository.interface';
import {
  Criteria,
  OrderCriteria,
} from '../../../core/domain/repository.interface';
import PrismaService from '../prisma/prisma.service';
import ITransactionCategory from '../../../core/domain/transactions/entities/transactionCategory.interface';
import {
  TransactionCategoryWhereInput,
  TransactionCategoryOrderByInput,
  TransactionCategoryCreateOneWithoutChildCategoriesInput,
  UserCredentialCreateOneWithoutTransactionCategoriesInput,
} from '../../../../generated/prisma-client';
import { TransactionCategory } from '../../graphql.schema.generated';
import IUserCredential from '../../../core/app/users/entities/userCredential.interface';
import { CacheService } from '../../cache.service';

@Injectable()
export default class TransactionCategoryRepository
  implements IRepository<ITransactionCategory> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('CategoryCacheService')
    private readonly cacheService: CacheService<ITransactionCategory>,
  ) {}

  public async insert(
    entity: ITransactionCategory,
  ): Promise<ITransactionCategory> {
    const { id, ...preparedData } = entity;
    let parentCategory: TransactionCategoryCreateOneWithoutChildCategoriesInput = null;
    let owner: UserCredentialCreateOneWithoutTransactionCategoriesInput = null;
    if (preparedData.parentCategory !== null) {
      parentCategory = { connect: { id: preparedData.parentCategory.id } };
    }
    if (preparedData.owner !== null) {
      owner = { connect: { id: preparedData.owner.id } };
    }
    const createdTransactionCategory: TransactionCategory = await this.prisma.client.createTransactionCategory(
      Object.assign(preparedData, { parentCategory, owner }),
    );
    return {
      id: createdTransactionCategory.id,
      isOutcome: createdTransactionCategory.isOutcome,
      isSystem: createdTransactionCategory.isSystem,
      name: createdTransactionCategory.name,
      owner: await this.getRelatedEntity(
        createdTransactionCategory.id,
        'owner',
      ),
      parentCategory: (await this.getRelatedEntity(
        createdTransactionCategory.id,
        'parentCategory',
      )) as ITransactionCategory,
    };
  }

  public async findAll(
    page: number,
    perPage: number,
    orderBy: OrderCriteria<ITransactionCategory>,
    searchCriteria: Criteria<ITransactionCategory>,
  ): Promise<ITransactionCategory[]> {
    const queryData: {
      where?: TransactionCategoryWhereInput;
      orderBy?: TransactionCategoryOrderByInput;
      skip?: number;
      after?: string;
      before?: string;
      first?: number;
      last?: number;
    } = {
      first: perPage,
      skip: (page - 1) * perPage,
    };
    if (Object.keys(orderBy).length > 0) {
      queryData.orderBy = `${Object.keys(orderBy)[0]}_${
        orderBy[Object.keys(orderBy)[0]]
      }` as TransactionCategoryOrderByInput;
    }
    if (Object.keys(searchCriteria).length > 0) {
      Object.keys(searchCriteria).forEach((key: string) => {
        queryData.where[key] = searchCriteria[key];
      });
    }
    const transactionCategories: TransactionCategory[] = await this.prisma.client.transactionCategories(
      queryData,
    );
    const result: ITransactionCategory[] = [];
    for await (const tc of transactionCategories) {
      result.push({
        id: tc.id,
        isOutcome: tc.isOutcome,
        isSystem: tc.isSystem,
        name: tc.name,
        owner: await this.getRelatedEntity(tc.id, 'owner'),
        parentCategory: (await this.getRelatedEntity(
          tc.id,
          'parentCategory',
        )) as ITransactionCategory,
      });
    }
    return result;
  }

  public async findById(id: string): Promise<ITransactionCategory> {
    const result: TransactionCategory = await this.prisma.client.transactionCategory(
      { id },
    );
    return {
      id: result.id,
      isOutcome: result.isOutcome,
      isSystem: result.isSystem,
      name: result.name,
      owner: await this.getRelatedEntity(result.id, 'owner'),
      parentCategory: (await this.getRelatedEntity(
        result.id,
        'parentCategory',
      )) as ITransactionCategory,
    };
  }

  public async findOneByAndCriteria(
    searchCriteria: Criteria<ITransactionCategory>,
  ): Promise<ITransactionCategory> {
    const result: ITransactionCategory[] = await this.findByAndCriteria(
      searchCriteria,
    );
    return result.length > 0 ? result[0] : null;
  }

  public async findByAndCriteria(
    searchCriteria: Criteria<ITransactionCategory>,
  ): Promise<ITransactionCategory[]> {
    const queryData: {
      where?: TransactionCategoryWhereInput;
    } = { where: {} };
    Object.keys(searchCriteria).forEach((key: string): void => {
      if (key === 'owner') {
        if (searchCriteria[key]) {
          queryData.where[key] = { id: searchCriteria[key].id };
        }
        return;
      }
      queryData.where[key] = searchCriteria[key];
    });
    const transactionCategories: TransactionCategory[] = await this.prisma.client.transactionCategories(
      queryData,
    );
    const result: ITransactionCategory[] = [];
    for await (const tc of transactionCategories) {
      result.push({
        id: tc.id,
        isOutcome: tc.isOutcome,
        isSystem: tc.isSystem,
        name: tc.name,
        owner: await this.getRelatedEntity(tc.id, 'owner'),
        parentCategory: (await this.getRelatedEntity(
          tc.id,
          'parentCategory',
        )) as ITransactionCategory,
      });
    }
    return result;
  }

  public async findByOrCriteria(
    searchCriteria: Criteria<ITransactionCategory>,
  ): Promise<ITransactionCategory[]> {
    const queryData: {
      where?: TransactionCategoryWhereInput;
    } = {};
    Object.keys(searchCriteria).reduce(
      (
        acc: TransactionCategoryWhereInput,
        key: string,
      ): TransactionCategoryWhereInput => {
        let temp: TransactionCategoryWhereInput = acc;
        while (temp.OR !== undefined) {
          temp = temp.OR as TransactionCategoryWhereInput;
        }
        temp.OR = {};
        temp.OR[key] = searchCriteria[key];
        return acc;
      },
      {},
    );
    const transactionCategories: TransactionCategory[] = await this.prisma.client.transactionCategories(
      queryData,
    );
    const result: ITransactionCategory[] = [];
    for await (const tc of transactionCategories) {
      result.push({
        id: tc.id,
        isOutcome: tc.isOutcome,
        isSystem: tc.isSystem,
        name: tc.name,
        owner: await this.getRelatedEntity(tc.id, 'owner'),
        parentCategory: (await this.getRelatedEntity(
          tc.id,
          'parentCategory',
        )) as ITransactionCategory,
      });
    }
    return result;
  }

  public async update(
    updateData: Criteria<ITransactionCategory>,
    id: string,
  ): Promise<ITransactionCategory> {
    if (updateData.parentCategory !== null) {
      await this.prisma.client.updateTransactionCategory({
        data: { parentCategory: { disconnect: true } },
        where: { id },
      });
      updateData.parentCategory = {
        connect: { id: updateData.parentCategory.id },
      };
    }
    const result: TransactionCategory = await this.prisma.client.updateTransactionCategory(
      {
        data: updateData,
        where: { id },
      },
    );
    return {
      ...result,
      parentCategory: (await this.getRelatedEntity(
        result.id,
        'parentCategory',
      )) as ITransactionCategory,
      owner: await this.getRelatedEntity(result.id, 'owner'),
    };
  }

  public async delete(
    deleteCriteria: Criteria<ITransactionCategory>,
  ): Promise<ITransactionCategory[]> {
    const transactionCategoriesForDelete: ITransactionCategory[] = await this.findByAndCriteria(
      deleteCriteria,
    );
    const result: ITransactionCategory[] = [];
    for await (const transaction of transactionCategoriesForDelete) {
      const tc: TransactionCategory = await this.prisma.client.deleteTransactionCategory(
        { id: transaction.id },
      );
      result.push({
        id: tc.id,
        isOutcome: tc.isOutcome,
        isSystem: tc.isSystem,
        name: tc.name,
        owner: await this.getRelatedEntity(tc.id, 'owner'),
        parentCategory: (await this.getRelatedEntity(
          tc.id,
          'parentCategory',
        )) as ITransactionCategory,
      });
    }
    return result;
  }

  public async getRelatedEntity(
    id: string,
    fieldName: keyof ITransactionCategory,
  ): Promise<IUserCredential | ITransactionCategory> {
    if (!['parentCategory', 'owner'].includes(fieldName)) {
      throw new Error(`${fieldName} of class doesn't have object type`);
    }
    if (fieldName === 'parentCategory') {
      try {
        const result: ITransactionCategory = await this.cacheService.get(
          `categories_${id}_parent`,
        );
        return result;
      } catch (e) {
        const result: ITransactionCategory = await this.prisma.client
          .transactionCategory({ id })
          .parentCategory();
        await this.cacheService.set(`categories_${id}_parent`, result);
        return result;
      }
    } else {
      return this.prisma.client.transactionCategory({ id }).owner();
    }
  }

  public getRelatedEntities(
    id: string,
    fieldName: keyof ITransactionCategory,
  ): Promise<never> {
    throw new Error(`${fieldName} of class doesn't have array type`);
  }
}
