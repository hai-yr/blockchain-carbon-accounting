// SPDX-License-Identifier: Apache-2.0
import {
  ChangeEvent,
  MouseEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  ForwardRefRenderFunction
} from "react";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";
import { getRoles } from "../services/contract-functions";
import TokenInfoModal, { TokenInfo } from "../components/token-info-modal";
import TrackerInfoModal from "../components/tracker-info-modal";
import { getBalances, countAuditorEmissionsRequests } from '../services/api.service';
import Paginator from "../components/paginate";
import QueryBuilder from "../components/query-builder";
import { Balance, BALANCE_FIELDS, TOKEN_TYPES } from "../components/static-data";
import { Web3Provider } from "@ethersproject/providers";
import DisplayTokenAmount from "../components/display-token-amount";

type DashboardProps = {
  provider?: Web3Provider, 
  signedInAddress: string, 
  displayAddress: string
}

type DashboardHandle = {
  refresh: ()=>void
}

const Dashboard: ForwardRefRenderFunction<DashboardHandle, DashboardProps> = ({ provider, signedInAddress, displayAddress }, ref) => {
  // Modal display and token it is set to
  const [modalShow, setModalShow] = useState(false);
  const [modalTrackerShow, setModaltrackerShow] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo>({});
  const [selectedTracker, setSelectedTracker] = useState({});

  // Balances of my tokens and tokens I've issued
  const [myBalances, setMyBalances] = useState<Balance[]>([]);
  const [fetchingTokens, setFetchingTokens] = useState(false);

  // const isDealer = (roles[0] === true || roles[1] === true || roles[2] === true || roles[3] === true || roles[4] === true);
  // const isIndustry = (roles[4] === true);
  const [, setDisplayAddressIsDealer] = useState(false);
  const [, setDisplayAddressIsIndustry] = useState(false);

  const [ balancePage, setBalancePage ] = useState(1);
  const [ balanceCount, setBalanceCount ] = useState(0);
  const [ balancePageSize, setBalancePageSize ] = useState(20);
  const [ balanceQuery, setBalanceQuery ] = useState<string[]>([]);

  const [ emissionsRequestsCount, setEmissionsRequestsCount ] = useState(0);

  async function handleBalancePageChange(_: ChangeEvent<HTMLInputElement>, value: number) {
    await fetchBalances(value, balancePageSize, balanceQuery);
  }

  async function handleBalancePageSizeChanged(event: ChangeEvent<HTMLInputElement>) {
    await fetchBalances(1, parseInt(event.target.value), balanceQuery);

  }

  async function handleBalanceQueryChanged(_query: string[]) {
    await fetchBalances(balancePage, balancePageSize, _query);
  }

  // Allows the parent component to refresh balances on clicking the Dashboard button in the navigation
  useImperativeHandle(ref, () => ({
    refresh() {
      handleRefresh();
    }
  }));

  async function handleRefresh() {
    // clear localStorage
    let localStorage = window.localStorage;
    localStorage.setItem('token_balances', '');

    setFetchingTokens(true);
    await fetchBalances(balancePage, balancePageSize, balanceQuery);
  }

  async function fetchAddressRoles(provider: Web3Provider, address: string) {
    if (!address || !address.length) {
      setDisplayAddressIsDealer(false);
      setDisplayAddressIsIndustry(false);
    } else {
      const dRoles = await getRoles(provider, address);
      setDisplayAddressIsDealer(!!dRoles.hasDealerRole);
      setDisplayAddressIsIndustry(!!dRoles.hasIndustryRole);
    }
  }

  useEffect(() => {
    if(provider) fetchAddressRoles(provider, displayAddress);
  }, [provider, displayAddress])

  const fetchBalances = useCallback(async (_balancePage: number, _balancePageSize: number, _balanceQuery: string[]) => {
    let newMyBalances: Balance[] = [];

    let _balanceCount = 0;
    try {
      // get total count of balance
      const query = `issuedTo,string,${signedInAddress},eq`;
      const offset = (_balancePage - 1) * _balancePageSize;

      // this count means total number of balances
      let {count, balances} = await getBalances(offset, _balancePageSize, [..._balanceQuery, query]);
      console.log('balances?', balances);
      // this count means total pages of balances
      _balanceCount = count % _balancePageSize === 0 ? count / _balancePageSize : Math.floor(count / _balancePageSize) + 1;


      for (let i = 0; i < balances.length; i++) {
        const balance = balances[i];

        let token = {
          ...balance,
          tokenId: balance.token.tokenId,
          token: balance.token,
          tokenType: TOKEN_TYPES[balance.token.tokenTypeId - 1],
          issuedTo: balance.issuedTo,
          availableBalance: balance.available,
          retiredBalance: balance.retired,
          transferredBalance: balance.transferred
        }
        newMyBalances.push(token);
      }
    } catch (error) {
      console.error(error);
    }

    setMyBalances(newMyBalances);
    setBalanceCount(_balanceCount);
    setBalancePage(_balancePage);
    setBalancePageSize(_balancePageSize);
    setBalanceQuery(_balanceQuery);
    setFetchingTokens(false);
  }, [signedInAddress]);


  // If address and provider detected then fetch balances
  useEffect(() => {
    const init = async () => {
      if (provider && signedInAddress) {
        if (myBalances !== [] && !fetchingTokens) {
          setFetchingTokens(true);
          await fetchBalances(balancePage, balancePageSize, balanceQuery);
        }
        let _emissionsRequestsCount = await countAuditorEmissionsRequests(signedInAddress);
        setEmissionsRequestsCount(_emissionsRequestsCount);

    } }
    init();
  }, [provider, signedInAddress]);

  function pointerHover(e: MouseEvent<HTMLElement>) {
    e.currentTarget.style.cursor = "pointer";
  }

  return (
    <>
      <TokenInfoModal
        show={modalShow}
        token={selectedToken}
        onHide={() => {
          setModalShow(false);
          setSelectedToken({});
        }}
      />
      <TrackerInfoModal
        show={modalTrackerShow}
        tracker={selectedTracker}
        onHide={() => {
          setModaltrackerShow(false);
          setSelectedTracker({});
        }}
      />

      <h2>Dashboard</h2>
      {(displayAddress) ? 
        <p className="mb-1">View token balances for {displayAddress}.</p>
        :
        <p className="mb-1">View your token balances.</p>
      }
      {(emissionsRequestsCount) ?
        <p className="mb-1">You have {emissionsRequestsCount} pending <a href='/emissionsrequests'>emissions audits</a>.</p>
        : null
      }
      <div className={fetchingTokens ? "dimmed" : ""}>

        {fetchingTokens && (
          <div className="text-center my-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        )}

        {(signedInAddress) &&
          <div className="mb-4">
            <h4>{(displayAddress) ? 'Their' : 'Your'} Tokens</h4>
            <QueryBuilder
              fieldList={BALANCE_FIELDS}
              handleQueryChanged={handleBalanceQueryChanged}
            />
            <Table hover size="sm">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Retired</th>
                  <th>Transferred (carbon tracker)</th>
                </tr>
              </thead>
              <tbody>
                {(myBalances !== [] && !fetchingTokens) &&
                  myBalances.map((balance) => (
                    <tr
                      key={balance.token.tokenId}
                      onClick={() => {
                        setSelectedToken({
                          ...balance.token,
                          availableBalance: balance.availableBalance,
                          retiredBalance: balance.retiredBalance
                        });
                        setModalShow(true);
                      }}
                      onMouseOver={pointerHover}
                      className={`${(Number(balance.availableBalance) <= 0) ? "table-secondary" : ""}`}
                    >
                      <td>{balance.token.tokenId}</td>
                      <td>{balance.tokenType}</td>
                      <td><DisplayTokenAmount amount={balance.availableBalance}/></td>
                      <td><DisplayTokenAmount amount={balance.retiredBalance}/></td>
                      <td><DisplayTokenAmount amount={balance.transferredBalance}/></td>
                    </tr>
                  ))}
              </tbody>
            </Table>
            {myBalances.length !== 0 ? <Paginator 
              count={balanceCount}
              page={balancePage}
              pageSize={balancePageSize}
              pageChangeHandler={handleBalancePageChange}
              pageSizeHandler={handleBalancePageSizeChanged}
            /> : <></>}
          </div>
        }


      </div>
    </>
  );
}

export default forwardRef(Dashboard);
