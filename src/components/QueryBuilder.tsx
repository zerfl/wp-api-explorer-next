"use client";

import React, { useMemo, useState } from "react";
import { useRequest } from "@/contexts/RequestContext";
import { WpRouteInfo, WpArg } from "@/lib/wp-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlidersHorizontal, ArrowUpDown, Layers, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface QueryBuilderProps {
  route: WpRouteInfo;
}

interface CustomParam {
  key: string;
  value: string;
}

export default function QueryBuilder({ route }: QueryBuilderProps) {
  const {
    state: { queryParams },
    actions: { setQueryParams },
  } = useRequest();

  const initialCustomParams = useMemo(() => {
    const endpointArgs = route.endpoints?.[0]?.args || {};
    const schemaKeys = Object.keys(endpointArgs);
    const customs: CustomParam[] = [];

    Object.entries(queryParams).forEach(([key, val]) => {
      if (!schemaKeys.includes(key) && key !== "page" && key !== "per_page" && key !== "_embed" && key !== "search") {
        customs.push({ key, value: val });
      }
    });

    return customs;
  }, [queryParams, route]);

  return (
    <QueryBuilderForm
      key={route.path}
      route={route}
      queryParams={queryParams}
      setQueryParams={setQueryParams}
      initialCustomParams={initialCustomParams}
    />
  );
}

interface QueryBuilderFormProps {
  route: WpRouteInfo;
  queryParams: Record<string, string>;
  setQueryParams: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  initialCustomParams: CustomParam[];
}

function QueryBuilderForm({
  route,
  queryParams,
  setQueryParams,
  initialCustomParams,
}: QueryBuilderFormProps) {
  const endpoint = route.endpoints?.[0];
  const args = endpoint?.args || {};
  const [customParams, setCustomParams] = useState<CustomParam[]>(initialCustomParams);

  const handleArgChange = (key: string, value: string | null | undefined) => {
    const newParams = { ...queryParams };
    if (value === "" || value === undefined || value === null) {
      delete newParams[key];
    } else {
      newParams[key] = value;
    }
    setQueryParams(newParams);
  };

  const addCustomParam = () => {
    setCustomParams([...customParams, { key: "", value: "" }]);
  };

  const updateCustomParam = (index: number, field: "key" | "value", val: string) => {
    const updated = [...customParams];
    updated[index][field] = val;
    setCustomParams(updated);

    const newParams = { ...queryParams };
    
    const schemaKeys = [...Object.keys(args), "page", "per_page", "_embed", "search"];
    Object.keys(newParams).forEach((k) => {
      if (!schemaKeys.includes(k)) {
        delete newParams[k];
      }
    });

    updated.forEach((item) => {
      if (item.key.trim()) {
        newParams[item.key.trim()] = item.value;
      }
    });
    
    setQueryParams(newParams);
  };

  const removeCustomParam = (index: number) => {
    const updated = customParams.filter((_, i) => i !== index);
    setCustomParams(updated);

    const newParams = { ...queryParams };
    const removedKey = customParams[index].key;
    if (removedKey) {
      delete newParams[removedKey];
    }
    setQueryParams(newParams);
  };

  // Group schema keys into categories
  const argKeys = Object.keys(args);
  
  const categories = {
    pagination: ["page", "per_page", "offset"],
    embedding: ["_embed", "_fields"],
    searchSort: ["search", "orderby", "order", "after", "before"],
  };

  const paginationArgs = argKeys.filter((key) => categories.pagination.includes(key));
  const embeddingArgs = argKeys.filter((key) => categories.embedding.includes(key));
  const searchSortArgs = argKeys.filter((key) => categories.searchSort.includes(key));
  
  const filterArgs = argKeys.filter(
    (key) =>
      !categories.pagination.includes(key) &&
      !categories.embedding.includes(key) &&
      !categories.searchSort.includes(key)
  );

  // Render form controls depending on argument schema type
  const renderArgControl = (key: string, arg: WpArg) => {
    const currentValue = queryParams[key] || "";
    const placeholder = arg.default !== undefined ? String(arg.default) : "";

    // 1. Boolean Switch
    if (arg.type === "boolean") {
      return (
        <div key={key} className="flex items-center justify-between rounded-md border border-border/40 bg-background/20 px-3 py-2">
          <div className="flex flex-col gap-0.5 max-w-[80%]">
            <Label htmlFor={`arg-${key}`} className="text-xs font-semibold cursor-pointer">
              {key}
            </Label>
            {arg.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">{arg.description}</span>
            )}
          </div>
          <Switch
            id={`arg-${key}`}
            checked={currentValue === "true" || currentValue === "1"}
            onCheckedChange={(checked) => handleArgChange(key, checked ? "true" : "")}
          />
        </div>
      );
    }

    // 2. Select Dropdown for Enums
    if (arg.enum && Array.isArray(arg.enum)) {
      return (
        <div key={key} className="space-y-1">
          <Label htmlFor={`arg-${key}`} className="text-xs font-semibold">
            {key}
          </Label>
          <Select
            value={currentValue}
            onValueChange={(val) => handleArgChange(key, val === "ALL" ? "" : val)}
          >
            <SelectTrigger id={`arg-${key}`} className="h-9.5 text-xs bg-background/50">
              <SelectValue placeholder={placeholder || `Select ${key}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">-- Clear parameter --</SelectItem>
              {arg.enum.map((option) => (
                <SelectItem key={String(option)} value={String(option)} className="text-xs">
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {arg.description && (
            <p className="text-xs text-muted-foreground">{arg.description}</p>
          )}
        </div>
      );
    }

    // 3. Select Dropdown for Array Enums (e.g. status)
    if (arg.type === "array" && arg.items?.enum && Array.isArray(arg.items.enum)) {
      return (
        <div key={key} className="space-y-1">
          <Label htmlFor={`arg-${key}`} className="text-xs font-semibold">
            {key} <span className="text-xs text-muted-foreground">(Array enum)</span>
          </Label>
          <Select
            value={currentValue}
            onValueChange={(val) => handleArgChange(key, val === "ALL" ? "" : val)}
          >
            <SelectTrigger id={`arg-${key}`} className="h-9.5 text-xs bg-background/50">
              <SelectValue placeholder={placeholder || `Select ${key}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">-- Clear parameter --</SelectItem>
              {arg.items.enum.map((option) => (
                <SelectItem key={String(option)} value={String(option)} className="text-xs">
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {arg.description && (
            <p className="text-xs text-muted-foreground">{arg.description}</p>
          )}
        </div>
      );
    }

    // 4. Default Text/Number Input
    const isNumber = arg.type === "integer" || arg.type === "number";
    return (
      <div key={key} className="space-y-1">
        <Label htmlFor={`arg-${key}`} className="text-xs font-semibold flex items-center justify-between">
          <span>{key}</span>
          <span className="text-xs font-normal uppercase text-muted-foreground">{arg.type}</span>
        </Label>
        <Input
          id={`arg-${key}`}
          type={isNumber ? "number" : "text"}
          placeholder={placeholder || `Enter value`}
          value={currentValue}
          onChange={(e) => handleArgChange(key, e.target.value)}
          className="h-9.5 text-xs bg-background/50"
        />
        {arg.description && (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {arg.description}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card/20 border border-border/40 rounded-lg p-4 backdrop-blur-md shadow-md">
      <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <SlidersHorizontal className="h-4.5 w-4.5 text-primary" />
          Request Query Builder
        </h3>
        <code className="text-xs bg-background px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground truncate max-w-[200px]">
          {route.path}
        </code>
      </div>

      <Tabs defaultValue="filters" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9.5 bg-background/60 p-1 border border-border/30 rounded-lg">
          <TabsTrigger value="filters" className="text-xs py-1">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" /> Filters
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs py-1">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Sort/Search
          </TabsTrigger>
          <TabsTrigger value="embedding" className="text-xs py-1">
            <Layers className="h-3.5 w-3.5 mr-1" /> Embed
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs py-1">
            <PlusCircle className="h-3.5 w-3.5 mr-1" /> Custom
          </TabsTrigger>
        </TabsList>

        {/* 1. Dynamic Filters Tab */}
        <TabsContent value="filters" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginationArgs.map((key) => renderArgControl(key, args[key]))}
            {filterArgs.map((key) => renderArgControl(key, args[key]))}

            {filterArgs.length === 0 && paginationArgs.length === 0 && (
              <div className="col-span-2 text-center py-6 text-xs text-muted-foreground">
                No standard filter arguments found for this endpoint.
              </div>
            )}
          </div>
        </TabsContent>

        {/* 2. Sorting and Search Tab */}
        <TabsContent value="search" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchSortArgs.map((key) => renderArgControl(key, args[key]))}
            
            {searchSortArgs.length === 0 && (
              <div className="col-span-2 text-center py-6 text-xs text-muted-foreground">
                No sorting/search arguments supported by this endpoint.
              </div>
            )}
          </div>
        </TabsContent>

        {/* 3. Embedding & Fields Tab */}
        <TabsContent value="embedding" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {embeddingArgs.map((key) => renderArgControl(key, args[key]))}

            {embeddingArgs.length === 0 && (
              <div className="col-span-2 text-center py-6 text-xs text-muted-foreground">
                No embedding/fields options available in this schema.
              </div>
            )}
          </div>
        </TabsContent>

        {/* 4. Custom Parameters Tab */}
        <TabsContent value="custom" className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add raw query parameters that are not specified in the schema (e.g. ACF fields, custom meta filters, or plugin arguments).
          </p>

          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {customParams.map((item, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  type="text"
                  placeholder="Param Key"
                  value={item.key}
                  onChange={(e) => updateCustomParam(index, "key", e.target.value)}
                  className="h-8.5 text-xs bg-background/50"
                />
                <Input
                  type="text"
                  placeholder="Param Value"
                  value={item.value}
                  onChange={(e) => updateCustomParam(index, "value", e.target.value)}
                  className="h-8.5 text-xs bg-background/50"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCustomParam(index)}
                  className="h-8.5 w-8.5 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomParam}
            className="w-full text-xs h-8.5 border-dashed"
          >
            <PlusCircle className="mr-1 h-4 w-4" />
            Add Custom Query Parameter
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
