import 'ts-jest';

import IRepository, { Criteria } from '../../domain/repository.interface';
import IDistributingMetricItem from '../transactions/entities/distributingMetricItem.interface';
import ITransaction from '../../domain/transactions/entities/transaction.interface';
import ITransactionCategory from '../../domain/transactions/entities/transactionCategory.interface';
import TransactionCategoryAbstractFactory from '../../domain/transactions/factories/transactionCategoryFactory';
import DistributingMetricItemAbstractFactory from '../transactions/factories/distributingMetricItemFactory';
import TransactionAbstractFactory from '../../domain/transactions/factories/transactionFactory';
import { AvailableAnalyticMetric } from '../../domain/transactions/enums/availableAnalyticMetric.enum';
import { Period } from '../../domain/period/enums/period.enum';
import TransactionAnalyticService from '../../domain/transactions/services/transactionAnalyticService';
import TransactionCategoryService from '../../domain/transactions/services/transactionCategoryService';
import ReportHasBeenGeneratedEvent from '../transactions/events/reportHasBeenGenerated.event';
import { EventStatus } from '../events/eventStatus.enum';
import IEventDispatchService from '../events/eventDispatchService.interface';
import ICurrencyConverterService from '../../domain/transactions/services/currencyConverterService.interface';
import ReportDistributionInteractor from '../transactions/interactors/reportDistribution.interactor';
import ReportDistributionOutputPort from '../transactions/ports/reportDistributionOutput.port';

import FakeReportDistributionOutputPort from './mocks/fakeReportDistributionOutputPort';
import FakeEventDispatchGeneratedReportService from './mocks/fakeEventDispatchGeneratedReportService';
import FakeCurrencyConverter from '../../domain/test/mocks/fakeCurrencyConverter';
import FakeDistributingMetricItemFactory from './mocks/fakeDistributingMetricItemFactory';
import FakeTransactionCategoryFactory from './mocks/fakeTransactionCategoryFactory';
import FakeTransactionFactory from './mocks/fakeTransactionFactory';

import { transactionForTransactionChangeMetrics } from '../../domain/test/fixtures/transactions';
import {
  firstCategory,
  secondCategory,
  thirdCategory,
  fourthCategory,
  fifthCategory,
  sixthCategory,
  seventhCategory,
} from '../../domain/test/fixtures/transactionCategories';
import { dateEndForTransactionChangeMetrics } from '../../domain/test/fixtures/dateRanges';
import {
  subscribeItems,
  generateDistributingMetricItemForMetricAndItem,
} from './fixtures/distributingMetricItems';

describe('TransactionCategoryInteractor tests', () => {
  DistributingMetricItemAbstractFactory.setInstance(
    new FakeDistributingMetricItemFactory([], {
      getInstance: (fields: Criteria<IDistributingMetricItem>) => null,
    }),
  );
  const fakeDistributingMetricItemFactory: DistributingMetricItemAbstractFactory = FakeDistributingMetricItemFactory.getInstance();
  const fakeDistributingMetricItemRepo: IRepository<IDistributingMetricItem> = fakeDistributingMetricItemFactory.createDistributingMetricItemRepo();
  TransactionCategoryAbstractFactory.setInstance(
    new FakeTransactionCategoryFactory(
      [
        firstCategory,
        secondCategory,
        thirdCategory,
        fourthCategory,
        fifthCategory,
        sixthCategory,
        seventhCategory,
      ],
      {
        getInstance: (fields: Criteria<ITransactionCategory>) => ({
          id: 'fakeId',
          isOutcome: fields.isOutcome ? fields.isOutcome : true,
          isSystem: fields.isSystem ? fields.isSystem : false,
          name: fields.name ? fields.name : '',
          owner: fields.owner ? fields.owner : null,
          parentCategory: fields.parentCategory ? fields.parentCategory : null,
        }),
      },
    ),
  );
  TransactionAbstractFactory.setInstance(
    new FakeTransactionFactory(transactionForTransactionChangeMetrics, {
      getInstance: (fields: Criteria<ITransaction>) => ({
        id: 'fakeId',
        amount: fields.amount ? fields.amount : 0,
        currency: fields.currency ? fields.currency : null,
        datetime: fields.datetime ? fields.datetime : new Date(),
        owner: fields.owner ? fields.owner : null,
        transactionCategory: fields.transactionCategory,
        description: fields.description ? fields.description : null,
      }),
    }),
  );
  const fakeTransactionFactory: TransactionAbstractFactory = FakeTransactionFactory.getInstance();
  const fakeTransactionCategoryFactory: TransactionCategoryAbstractFactory = FakeTransactionCategoryFactory.getInstance();
  const fakeTransactionRepo: IRepository<ITransaction> = fakeTransactionFactory.createTransactionRepo();
  const faketransactionCategoryRepo: IRepository<ITransactionCategory> = fakeTransactionCategoryFactory.createTransactionCategoryRepo();
  const fakeCurrencyConverter: ICurrencyConverterService = new FakeCurrencyConverter();
  const transactionCategoryService: TransactionCategoryService = new TransactionCategoryService(
    faketransactionCategoryRepo,
  );
  const transactionAnalyticService: TransactionAnalyticService = new TransactionAnalyticService(
    [],
    fakeCurrencyConverter,
    transactionCategoryService,
  );
  const eventDispatcher: IEventDispatchService<ReportHasBeenGeneratedEvent> = new FakeEventDispatchGeneratedReportService();
  const outputPort: ReportDistributionOutputPort = new FakeReportDistributionOutputPort();
  const service: ReportDistributionInteractor = new ReportDistributionInteractor(
    fakeDistributingMetricItemRepo,
    fakeTransactionRepo,
    transactionAnalyticService,
    eventDispatcher,
    outputPort,
  );

  beforeAll(() => {
    service['defineDateRange'] = jest
      .fn()
      .mockImplementation((period: Period): [Date, Date] => {
        const startDate: Date = new Date(dateEndForTransactionChangeMetrics);
        switch (period) {
          case Period.MONTH:
            if (startDate.getMonth() > 1) {
              startDate.setMonth(startDate.getMonth() - 1);
            } else {
              startDate.setFullYear(startDate.getFullYear() - 1);
              startDate.setMonth(11);
            }
            break;
          case Period.QUARTER:
            if (startDate.getMonth() == 1) {
              throw new Error('Quarter has not been ended yet!');
            }
            if (startDate.getMonth() == 0) {
              startDate.setFullYear(startDate.getFullYear() - 1);
              startDate.setMonth(8);
            } else if (startDate.getMonth() == 2) {
              startDate.setFullYear(startDate.getFullYear() - 1);
              startDate.setMonth(11);
            } else {
              startDate.setMonth(startDate.getMonth() - 3);
            }
            break;
          case Period.YEAR:
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        }
        const endDate: Date = new Date(dateEndForTransactionChangeMetrics);
        return [startDate, endDate];
      });
  });

  it('check methods existance', () => {
    expect(service.subscribe).toBeDefined();
    expect(service.unsubscribe).toBeDefined();
    expect(service.send).toBeDefined();
  });

  it('test ReportHasBeenGeneratedEvent state', () => {
    expect(new ReportHasBeenGeneratedEvent(null, {}).state).toBe(
      EventStatus.WAITING,
    );
  });

  it('test subscribe method: some insert error', async () => {
    jest
      .spyOn(fakeDistributingMetricItemRepo, 'insert')
      .mockReturnValueOnce(Promise.reject(new Error('Insert error')));
    try {
      await service.subscribe(subscribeItems);
    } catch (e) {
      expect(e.message).toBe('Insert error');
    }
    jest.spyOn(fakeDistributingMetricItemRepo, 'insert').mockClear();
  });

  it('test subscribe method', async () => {
    expect(await service.subscribe(subscribeItems)).not.toBeInstanceOf(Error);
  });

  it('test unsubscribe method: some delete error', async () => {
    jest
      .spyOn(fakeDistributingMetricItemRepo, 'delete')
      .mockReturnValueOnce(Promise.reject(new Error('Delete error')));
    try {
      await service.unsubscribe(subscribeItems);
    } catch (e) {
      expect(e.message).toBe('Delete error');
    }
    jest.spyOn(fakeDistributingMetricItemRepo, 'delete').mockClear();
  });

  it('test unsubscribe method', async () => {
    jest
      .spyOn(fakeDistributingMetricItemRepo, 'delete')
      .mockReturnValueOnce(Promise.resolve(null));
    expect(await service.unsubscribe(subscribeItems)).not.toBeInstanceOf(Error);
    jest.spyOn(fakeDistributingMetricItemRepo, 'delete').mockClear();
  });

  it('test send method: month period and TRANSACTIONS_COUNT_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual(0);
  });

  it('test send method: quarter period and TRANSACTIONS_COUNT_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual(1);
  });

  it('test send method: year period and TRANSACTIONS_COUNT_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual(5);
  });

  it('test send method: month period and TRANSACTIONS_SUM_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual(0_00);
  });

  it('test send method: quarter period and TRANSACTIONS_SUM_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual(5_01);
  });

  it('test send method: year period and TRANSACTIONS_SUM_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual(250_02);
  });

  it('test send method: month period and TRANSACTIONS_COUNT_BY_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_BY_DATE_RANGE,
        ),
      ),
    ).toEqual(0);
  });

  it('test send method: quarter period and TRANSACTIONS_COUNT_BY_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_BY_DATE_RANGE,
        ),
      ),
    ).toEqual(1);
  });

  it('test send method: year period and TRANSACTIONS_COUNT_BY_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_BY_DATE_RANGE,
        ),
      ),
    ).toEqual(5);
  });

  it('test send method: month period and TRANSACTIONS_SUM_BY_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_BY_DATE_RANGE,
        ),
      ),
    ).toEqual(0_00);
  });

  it('test send method: quarter period and TRANSACTIONS_SUM_BY_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_BY_DATE_RANGE,
        ),
      ),
    ).toEqual(5_01);
  });

  it('test send method: year period and TRANSACTIONS_SUM_BY_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_BY_DATE_RANGE,
        ),
      ),
    ).toEqual(250_02);
  });

  it('test send method: month period and TRANSACTIONS_COUNT_RATIO_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_RATIO_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '2': 0, '3': 0, '4': 0 });
  });

  it('test send method: quarter period and TRANSACTIONS_COUNT_RATIO_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_RATIO_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '2': 0, '3': 0, '4': 0 });
  });

  it('test send method: year period and TRANSACTIONS_COUNT_RATIO_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_RATIO_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '2': 0, '3': 0, '4': 0 });
  });

  it('test send method: month period and TRANSACTIONS_SUM_RATIO_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_RATIO_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '2': 0, '3': 0, '4': 0 });
  });

  it('test send method: quarter period and TRANSACTIONS_SUM_RATIO_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_RATIO_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '2': 0, '3': 0, '4': 0 });
  });

  it('test send method: year period and TRANSACTIONS_SUM_RATIO_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_RATIO_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '2': 0, '3': 0, '4': 0 });
  });

  it('test send method: month period and TRANSACTIONS_COUNT_CHANGE_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_CHANGE_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '30.08.2019': 0_00 });
  });

  it('test send method: quarter period and TRANSACTIONS_COUNT_CHANGE_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_CHANGE_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '30.06.2019': 1 });
  });

  it('test send method: year period and TRANSACTIONS_COUNT_CHANGE_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_COUNT_CHANGE_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '30.09.2018': 5 });
  });

  it('test send method: month period and TRANSACTIONS_SUM_CHANGE_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.MONTH,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_CHANGE_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '30.08.2019': 0_00 });
  });

  it('test send method: quarter period and TRANSACTIONS_SUM_CHANGE_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.QUARTER,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_CHANGE_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '30.06.2019': 5_01 });
  });

  it('test send method: year period and TRANSACTIONS_SUM_CHANGE_BY_CATEGORY_AND_DATE_RANGE metric', async () => {
    expect(
      await service.send(
        generateDistributingMetricItemForMetricAndItem(
          Period.YEAR,
          AvailableAnalyticMetric.TRANSACTIONS_SUM_CHANGE_BY_CATEGORY_AND_DATE_RANGE,
        ),
      ),
    ).toEqual({ '30.09.2018': 250_02 });
  });

  afterAll(() => {
    jest.spyOn(service, 'send').mockClear();
  });
});
