import type { Async, Readable } from "@zarrita/storage";
import type { ArrayMetadata, DataType, GroupMetadata } from "./metadata.js";

import { Array, Group, Location } from "./hierarchy.js";
import { NodeNotFoundError } from "./errors.js";
import {
	v2_to_v3_array_metadata,
	v2_to_v3_group_metadata,
} from "./metadata.js";
import { json_decode_object } from "./util.js";

function open_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "group" },
): Promise<Group<Store>>;

function open_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "array" },
): Promise<Array<DataType, Store>>;

function open_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" },
): Promise<Array<DataType, Store> | Group<Store>>;

function open_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
): Promise<Array<DataType, Store> | Group<Store>>;

async function open_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" | "array" | "group" } = { kind: "auto" },
) {
	let loc = "store" in location ? location : new Location(location);
	if (options.kind === "array") return open_array_v2(loc);
	if (options.kind === "group") return open_group_v2(loc);
	return open_array_v2(loc).catch((err) => {
		if (err instanceof NodeNotFoundError) return open_group_v2(loc);
		throw err;
	});
}

async function open_array_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { path } = location.resolve(".zarray");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	return new Array(
		location.store,
		location.path,
		v2_to_v3_array_metadata(json_decode_object(meta)),
	);
}

async function open_group_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { path } = location.resolve(".zgroup");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	return new Group(
		location.store,
		location.path,
		v2_to_v3_group_metadata(json_decode_object(meta)),
	);
}

async function _open_v3<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { store, path } = location.resolve("zarr.json");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	let meta_doc: ArrayMetadata<DataType> | GroupMetadata = json_decode_object(
		meta,
	);
	return meta_doc.node_type === "array"
		? new Array(store, location.path, meta_doc)
		: new Group(store, location.path, meta_doc);
}

function open_v3<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "group" },
): Promise<Group<Store>>;

function open_v3<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "array" },
): Promise<Array<DataType, Store>>;

function open_v3<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" },
): Promise<Array<DataType, Store> | Group<Store>>;

function open_v3<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
): Promise<Array<DataType, Store> | Group<Store>>;

async function open_v3<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
	options: { kind: "auto" | "array" | "group" } = { kind: "auto" },
): Promise<Array<DataType, Store> | Group<Store>> {
	let loc = "store" in location ? location : new Location(location);
	let node = await _open_v3(loc);
	if (options.kind === "auto") return node;
	if (options.kind === "array" && node instanceof Array) return node;
	if (options.kind === "group" && node instanceof Group) return node;
	let kind = node instanceof Array ? "array" : "group";
	throw new Error(`Expected node of kind ${options.kind}, found ${kind}.`);
}

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "group" },
): Promise<Group<Store>>;

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "array" },
): Promise<Array<DataType, Store>>;

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" },
): Promise<Array<DataType, Store> | Group<Store>>;

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
): Promise<Array<DataType, Store> | Group<Store>>;

export async function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" | "array" | "group" } = { kind: "auto" },
): Promise<Array<DataType, Store> | Group<Store>> {
	return open_v3(location, options as any).catch((err) => {
		if (err instanceof NodeNotFoundError) {
			return open_v2(location, options as any);
		}
		throw err;
	});
}

open.v2 = open_v2;
open.v3 = open_v3;