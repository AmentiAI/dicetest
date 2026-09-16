// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Character dice NFTs. Token ids start at 1. Skin 0–5 maps to in-app die tones.
contract BlockDiceNft {
    string public name = "Block Dice";
    string public symbol = "BDICE";
    address public owner;
    string public baseUri;
    uint256 public nextId = 1;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => uint8) public skin;
    mapping(address => uint256[]) private _owned;
    mapping(uint256 => uint256) private _ownedIndex;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    error NotOwner();
    error NotAuthorized();
    error BadReceiver();
    error BadSkin();

    constructor(string memory _baseUri) {
        owner = msg.sender;
        baseUri = _baseUri;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setBaseUri(string calldata uri) external onlyOwner {
        baseUri = uri;
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert BadReceiver();
        owner = next;
    }

    function mint(address to, uint8 skinId) external onlyOwner returns (uint256 id) {
        if (to == address(0)) revert BadReceiver();
        if (skinId > 5) revert BadSkin();
        id = nextId++;
        skin[id] = skinId;
        _ownerOf[id] = to;
        balanceOf[to] += 1;
        _addToken(to, id);
        emit Transfer(address(0), to, id);
    }

    function ownerOf(uint256 tokenId) public view returns (address o) {
        o = _ownerOf[tokenId];
        if (o == address(0)) revert NotOwner();
    }

    function tokensOfOwner(address o) external view returns (uint256[] memory) {
        return _owned[o];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        return string.concat(baseUri, _toString(tokenId));
    }

    function approve(address spender, uint256 tokenId) external {
        address o = ownerOf(tokenId);
        if (msg.sender != o && !isApprovedForAll[o][msg.sender]) revert NotAuthorized();
        getApproved[tokenId] = spender;
        emit Approval(o, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        _transfer(from, to, tokenId);
        if (to.code.length > 0) {
            (bool ok, bytes memory ret) = to.call(
                abi.encodeWithSignature(
                    "onERC721Received(address,address,uint256,bytes)",
                    msg.sender,
                    from,
                    tokenId,
                    ""
                )
            );
            if (
                !ok ||
                ret.length != 32 ||
                abi.decode(ret, (bytes4)) != 0x150b7a02
            ) revert BadReceiver();
        }
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        if (to == address(0)) revert BadReceiver();
        address o = ownerOf(tokenId);
        if (o != from) revert NotOwner();
        if (
            msg.sender != o &&
            msg.sender != getApproved[tokenId] &&
            !isApprovedForAll[o][msg.sender]
        ) revert NotAuthorized();
        delete getApproved[tokenId];
        _removeToken(from, tokenId);
        _addToken(to, tokenId);
        _ownerOf[tokenId] = to;
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        emit Transfer(from, to, tokenId);
    }

    function _addToken(address to, uint256 id) internal {
        _ownedIndex[id] = _owned[to].length;
        _owned[to].push(id);
    }

    function _removeToken(address from, uint256 id) internal {
        uint256[] storage list = _owned[from];
        uint256 idx = _ownedIndex[id];
        uint256 last = list.length - 1;
        if (idx != last) {
            uint256 lastId = list[last];
            list[idx] = lastId;
            _ownedIndex[lastId] = idx;
        }
        list.pop();
        delete _ownedIndex[id];
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f || interfaceId == 0x01ffc9a7;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
